import { decodeUtf8From } from "./u8.ts";

interface Context {
  buf: Uint8Array;
  view: DataView;
  pos: number;
}

function readU16(ctx: Context): number {
  const v = ctx.view.getUint16(ctx.pos);
  ctx.pos += 2;
  return v;
}
function readU32(ctx: Context): number {
  const v = ctx.view.getUint32(ctx.pos);
  ctx.pos += 4;
  return v;
}
function readU53(ctx: Context): number {
  const hi = ctx.view.getUint32(ctx.pos);
  const lo = ctx.view.getUint32(ctx.pos + 4);
  ctx.pos += 8;
  return hi * 0x100000000 + lo;
}

function readArg(ctx: Context, info: number): number {
  if (info < 24) return info;

  switch (info) {
    case 24:
      return ctx.buf[ctx.pos++];
    case 25:
      return readU16(ctx);
    case 26:
      return readU32(ctx);
    case 27:
      return readU53(ctx);
    default:
      throw new Error(`invalid argument encoding (${info})`);
  }
}

function readF64(ctx: Context): number {
  const v = ctx.view.getFloat64(ctx.pos);
  ctx.pos += 8;
  return v;
}

const fromCharCode = String.fromCharCode;
function readString(ctx: Context, length: number): string {
  // fast path for short ascii strings
  // lifted & adapted from cbor-x
  outer: do {
    if (length >= 16) break outer;

    if (length < 4) {
      if (length < 2) {
        if (length === 0) return "";
        const a = ctx.buf[ctx.pos++];
        if ((a & 0x80) !== 0) {
          ctx.pos -= 1;
          break outer;
        }
        return fromCharCode(a);
      } else {
        const a = ctx.buf[ctx.pos++];
        const b = ctx.buf[ctx.pos++];
        if ((a | b) & 0x80) {
          ctx.pos -= 2;
          break outer;
        }
        if (length < 3) return fromCharCode(a, b);
        const c = ctx.buf[ctx.pos++];
        if (c & 0x80) {
          ctx.pos -= 3;
          break outer;
        }
        return fromCharCode(a, b, c);
      }
    } else {
      const a = ctx.buf[ctx.pos++];
      const b = ctx.buf[ctx.pos++];
      const c = ctx.buf[ctx.pos++];
      const d = ctx.buf[ctx.pos++];
      if ((a | b | c | d) & 0x80) {
        ctx.pos -= 4;
        break outer;
      }
      if (length < 6) {
        if (length === 4) return fromCharCode(a, b, c, d);
        const e = ctx.buf[ctx.pos++];
        if ((a | b | c | d | e) & 0x80) {
          ctx.pos -= 5;
          break outer;
        }
        return fromCharCode(a, b, c, d, e);
      } else if (length < 8) {
        const e = ctx.buf[ctx.pos++];
        const f = ctx.buf[ctx.pos++];
        if ((a | b | c | d | e | f) & 0x80) {
          ctx.pos -= 6;
          break outer;
        }
        if (length < 7) return fromCharCode(a, b, c, d, e, f);
        const g = ctx.buf[ctx.pos++];
        if ((a | b | c | d | e | f | g) & 0x80) {
          ctx.pos -= 7;
          break outer;
        }
        return fromCharCode(a, b, c, d, e, f, g);
      } else {
        const e = ctx.buf[ctx.pos++];
        const f = ctx.buf[ctx.pos++];
        const g = ctx.buf[ctx.pos++];
        const h = ctx.buf[ctx.pos++];
        if ((e | f | g | h) & 0x80) {
          ctx.pos -= 8;
          break outer;
        }
        if (length < 10) {
          if (length === 8) return fromCharCode(a, b, c, d, e, f, g, h);
          const i = ctx.buf[ctx.pos++];
          if (i & 0x80) {
            ctx.pos -= 9;
            break outer;
          }
          return fromCharCode(a, b, c, d, e, f, g, h, i);
        } else if (length < 12) {
          const i = ctx.buf[ctx.pos++];
          const j = ctx.buf[ctx.pos++];
          if ((a | b | c | d | e | f | g | h | i | j) & 0x80) {
            ctx.pos -= 10;
            break outer;
          }
          if (length < 11) return fromCharCode(a, b, c, d, e, f, g, h, i, j);
          const k = ctx.buf[ctx.pos++];
          if (k & 0x80) {
            ctx.pos -= 11;
            break outer;
          }
          return fromCharCode(a, b, c, d, e, f, g, h, i, j, k);
        } else {
          const i = ctx.buf[ctx.pos++];
          const j = ctx.buf[ctx.pos++];
          const k = ctx.buf[ctx.pos++];
          const l = ctx.buf[ctx.pos++];
          if ((i | j | k | l) & 0x80) {
            ctx.pos -= 12;
            break outer;
          }
          if (length < 14) {
            if (length === 12) return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l);
            const m = ctx.buf[ctx.pos++];
            if ((m & 0x80) > 0) {
              ctx.pos -= 13;
              break outer;
            }
            return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m);
          } else {
            const m = ctx.buf[ctx.pos++];
            const n = ctx.buf[ctx.pos++];
            if ((m | n) & 0x80) {
              ctx.pos -= 14;
              break outer;
            }
            if (length < 15) return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n);
            const o = ctx.buf[ctx.pos++];
            if (o & 0x80) {
              ctx.pos -= 15;
              break outer;
            }
            return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o);
          }
        }
      }
    }
  } while (false);

  const str = decodeUtf8From(ctx.buf, ctx.pos, length);
  ctx.pos += length;
  return str;
}

function readBytes(ctx: Context, length: number): Uint8Array {
  return ctx.buf.subarray(ctx.pos, (ctx.pos += length));
}

function readValue(ctx: Context): unknown {
  const header = ctx.buf[ctx.pos++];
  const type = header >> 5;
  const info = header & 0x1f;

  switch (type) {
    case 0:
      return readArg(ctx, info);
    case 1:
      return -1 - readArg(ctx, info);
    case 2:
      return readBytes(ctx, readArg(ctx, info));
    case 3:
      return readString(ctx, readArg(ctx, info));
    case 4: {
      const len = readArg(ctx, info);
      const arr = new Array(len);
      for (let i = 0; i < len; i++) arr[i] = readValue(ctx);
      return arr;
    }
    case 5: {
      const len = readArg(ctx, info);
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < len; i++) {
        const keyHeader = ctx.buf[ctx.pos++];
        const keyType = keyHeader >> 5;
        const keyInfo = keyHeader & 0x1f;
        if (keyType !== 3) throw new TypeError(`invalid map key type (${keyType}, ${keyInfo})`);

        const keyLen = readArg(ctx, keyInfo);
        const k = readString(ctx, keyLen);
        const v = readValue(ctx);

        if (k === "__proto__") {
          Reflect.defineProperty(obj, "__proto__", {
            enumerable: true,
            configurable: true,
            writable: true,
          });
        }

        obj[k] = v;
      }
      return obj;
    }
    case 7: {
      switch (info) {
        case 20:
          return false;
        case 21:
          return true;
        case 22:
          return null;
        case 23:
          return undefined;
        case 27:
          return readF64(ctx);
        default:
          throw new Error(`unknown simple value (${info})`);
      }
    }
    default: {
      throw new TypeError(`unknown type (${type}, ${info})`);
    }
  }
}

/**
 * decode CBOR-formatted data into a JavaScript value
 *
 * ```ts
 * import { decodeCBOR } from "./decode.ts";
 *
 * // decode CBOR data:
 * const cborData = new Uint8Array([0x65, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
 * const decoded = decodeCBOR(cborData); // "hello"
 *
 * // works on roundtrip:
 * const encoded = encodeCBOR({ name: "Alice", age: 30 });
 * const data = decodeCBOR(encoded); // { name: "Alice", age: 30 }
 * ```
 */
export function decodeCBOR(buf: Uint8Array): unknown {
  const ctx: Context = {
    buf,
    view: new DataView(buf.buffer, buf.byteOffset, buf.byteLength),
    pos: 0,
  };
  return readValue(ctx);
}

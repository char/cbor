import * as hegel from "@hegeldev/hegel";
import * as gs from "@hegeldev/hegel/generators";
import { assertEquals } from "@std/assert";
import { decodeCBOR, encodeCBOR } from "@char/cbor";

type CBORValue = null | boolean | number | string | CBORValue[] | { [key: string]: CBORValue };

const cborScalar: gs.Generator<CBORValue> = gs.oneOf<CBORValue>(
  gs.just(null),
  gs.booleans(),
  gs.integers({
    minValue: Number.MIN_SAFE_INTEGER,
    maxValue: Number.MAX_SAFE_INTEGER,
  }),
  gs.text({ codec: "utf-8", maxSize: 64 }),
);
const cborObjectKey = gs.text({ codec: "utf-8", maxSize: 32 }).map((key) => `:${key}`);

function cborValue(depth: number): gs.Generator<CBORValue> {
  if (depth === 0) return cborScalar;

  const child = cborValue(depth - 1);
  const array: gs.Generator<CBORValue> = gs.arrays(child, { maxSize: 5 });
  const object: gs.Generator<CBORValue> = gs
    .maps(cborObjectKey, child, { maxSize: 5 })
    .map((entries) => Object.fromEntries(entries));

  return gs.oneOf<CBORValue>(cborScalar, array, object);
}

const hostileNames = gs.sampledFrom([
  "",
  "0",
  "00",
  "-1",
  "4294967294",
  "4294967295",
  "__proto__",
  "constructor",
  "prototype",
  "toCBOR",
  "toJSON",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "\0",
  "a\0b",
  "\uD800",
  "\uDC00",
  "💣",
]);

const objectKey = gs.oneOf(gs.text({ maxSize: 32 }), hostileNames);
const arrayPropertyKey = gs.sampledFrom([
  "extra",
  "-1",
  "4294967295",
  "__proto__",
  "constructor",
  "toJSON",
  "toCBOR",
]);

const scalar: gs.Generator<unknown> = gs.oneOf<unknown>(
  gs.just(null),
  gs.just(undefined),
  gs.booleans(),
  gs.integers({
    minValue: Number.MIN_SAFE_INTEGER,
    maxValue: Number.MAX_SAFE_INTEGER,
  }),
  gs.floats({ allowNan: true, allowInfinity: true }),
  gs.sampledFrom([
    -0,
    Number.MIN_VALUE,
    Number.MAX_VALUE,
    Number.EPSILON,
    Number.MIN_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    Infinity,
    -Infinity,
    NaN,
  ]),
  gs.text({ maxSize: 64 }),
  hostileNames,
  gs.binary({ maxSize: 64 }),
  gs.bigIntegers(),
  gs.sampledFrom<unknown>([
    Symbol("symbol"),
    () => {},
    new Map([["key", "value"]]),
    new Set([1, 2, 3]),
    /regexp/giu,
    new ArrayBuffer(8),
    new DataView(new ArrayBuffer(8)),
    new Int8Array([-128, 0, 127]),
    new Uint16Array([0, 65535]),
    new Number(1),
    new String("string"),
    new Boolean(false),
  ]),
);

function objectFrom(
  entries: Map<string, unknown>,
  prototype: object | null = Object.prototype,
): Record<string, unknown> {
  const object = Object.create(prototype) as Record<string, unknown>;

  for (const [key, value] of entries) {
    Reflect.defineProperty(object, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  return object;
}

function javascriptValue(depth: number): gs.Generator<unknown> {
  if (depth === 0) return scalar;

  const child = javascriptValue(depth - 1);
  const entries = gs.maps(objectKey, child, { maxSize: 5 });
  const children = gs.arrays(child, { maxSize: 5 });

  const denseArray = children.map((values) => values);

  const sparseArray = children.map((values) => {
    const array = new Array(values.length * 2);
    for (let index = 0; index < values.length; index++) {
      array[index * 2] = values[index];
    }
    return array;
  });

  const arrayWithProperties = gs
    .tuples(children, arrayPropertyKey, child)
    .map(([values, key, value]) => {
      Reflect.defineProperty(values, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      return values;
    });

  const plainObject = entries.map((entries) => objectFrom(entries));
  const nullPrototypeObject = entries.map((entries) => objectFrom(entries, null));
  const customPrototypeObject = entries.map((entries) =>
    objectFrom(entries, { inherited: "value" }),
  );

  const accessorObject = entries.map((entries) => {
    const object: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      Reflect.defineProperty(object, key, {
        get: () => value,
        enumerable: true,
        configurable: true,
      });
    }
    return object;
  });

  const objectWithHiddenProperty = gs
    .tuples(entries, objectKey, child)
    .map(([entries, key, value]) => {
      const object = objectFrom(entries);
      Reflect.defineProperty(object, key, { value, enumerable: false });
      return object;
    });

  const objectWithSymbolProperty = gs.tuples(entries, child).map(([entries, value]) => {
    const object = objectFrom(entries);
    Reflect.defineProperty(object, Symbol("key"), {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    return object;
  });

  const immutableObject = entries.map((entries) => Object.freeze(objectFrom(entries)));

  return gs.oneOf<unknown>(
    scalar,
    denseArray,
    sparseArray,
    arrayWithProperties,
    plainObject,
    nullPrototypeObject,
    customPrototypeObject,
    accessorObject,
    objectWithHiddenProperty,
    objectWithSymbolProperty,
    immutableObject,
  );
}

Deno.test("CBOR values survive a round trip", () => {
  const values = cborValue(3);

  hegel.test(
    (testCase) => {
      const value = testCase.draw(values);
      assertEquals(decodeCBOR(encodeCBOR(value)), value);
    },
    { testCases: 4096 },
  );
});

Deno.test("JavaScript values either fail to encode or round trip exactly", () => {
  const values = javascriptValue(3);

  hegel.test(
    (testCase) => {
      const value = testCase.draw(values);

      let encoded: Uint8Array;
      try {
        encoded = encodeCBOR(value);
      } catch {
        return;
      }

      assertEquals(decodeCBOR(encoded), value);
    },
    { testCases: 4096 },
  );
});

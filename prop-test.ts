import * as hegel from "@hegeldev/hegel";
import * as gs from "@hegeldev/hegel/generators";
import { assertEquals } from "@std/assert";
import { decodeCBOR, encodeCBOR } from "@char/cbor";

type CBORValue =
  | null
  | boolean
  | number
  | string
  | CBORValue[]
  | {
    [key: string]: CBORValue;
  };

const scalar: gs.Generator<CBORValue> = gs.oneOf<CBORValue>(
  gs.just(null),
  gs.booleans(),
  gs.integers({
    minValue: Number.MIN_SAFE_INTEGER,
    maxValue: Number.MAX_SAFE_INTEGER,
  }),
  gs.text(),
);

const objectKey = gs.text({ maxSize: 32 });

function cborValue(
  depth: number,
  containerOnly = false,
): gs.Generator<CBORValue> {
  if (depth === 0) return scalar;

  const child = cborValue(depth - 1);
  const array: gs.Generator<CBORValue> = gs.arrays(child, { maxSize: 5 });
  const object: gs.Generator<CBORValue> = gs
    .maps(objectKey, child, { maxSize: 5 })
    .map((entries) => Object.fromEntries(entries));

  return containerOnly
    ? gs.oneOf<CBORValue>(array, object)
    : gs.oneOf<CBORValue>(scalar, array, object);
}

Deno.test("objects & arrays survive a CBOR round trip", () => {
  const values = cborValue(3, true);

  hegel.test(
    (testCase) => {
      const value = testCase.draw(values);
      assertEquals(decodeCBOR(encodeCBOR(value)), value);
    },
    { testCases: 4096 },
  );
});

import * as hegel from "@hegeldev/hegel";
import * as gs from "@hegeldev/hegel/generators";
import { decodeCBOR, encodeCBOR } from "@char/cbor";

Deno.test("finite integers survive a CBOR round trip", () => {
  hegel.test(
    (testCase) => {
      const value = testCase.draw(
        gs.integers({
          minValue: Number.MIN_SAFE_INTEGER,
          maxValue: Number.MAX_SAFE_INTEGER,
        }),
      );
      const decoded = decodeCBOR(encodeCBOR(value));
      if (!Object.is(decoded, value)) {
        throw new Error(`decoded ${decoded} instead of ${value}`);
      }
    },
    { testCases: 16384 },
  );
});

Deno.test("strings survive a CBOR round trip", () => {
  hegel.test(
    (testCase) => {
      const value = testCase.draw(gs.text());
      const decoded = decodeCBOR(encodeCBOR(value));
      if (decoded !== value) {
        throw new Error(
          `decoded ${JSON.stringify(decoded)} instead of ${JSON.stringify(value)}`,
        );
      }
    },
    { testCases: 16384 },
  );
});

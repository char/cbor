import { decodeCBOR, encodeCBOR } from "@char/cbor";
import * as cborx from "npm:cbor-x";
// import * as cbor2 from "npm:cbor2";
import * as currCBOR from "jsr:@char/cbor";

const BATCH_SIZE = 64;

// dreamlab network snapshot packet
const snapshotData = await Deno.readFile("./_test/snapshot.cbor");
const snapshot = currCBOR.decodeCBOR(snapshotData);

import { assertEquals } from "jsr:@std/assert";
assertEquals(decodeCBOR(snapshotData), snapshot);

/* Deno.bench("cbor2", { group: "encode" }, () => {
  const results = new Array(BATCH_SIZE);

  for (let i = 0; i < results.length; i++) {
    results[i] = cbor2.encode(snapshot);
  }
}); */

Deno.bench("@char/cbor", { group: "encode" }, () => {
  const results = new Array(BATCH_SIZE);

  for (let i = 0; i < results.length; i++) {
    results[i] = encodeCBOR(snapshot);
  }
});

Deno.bench("jsr @char/cbor", { group: "encode" }, () => {
  const results = new Array(BATCH_SIZE);

  for (let i = 0; i < results.length; i++) {
    results[i] = currCBOR.encodeCBOR(snapshot);
  }
});

/* Deno.bench("cbor-x", { group: "encode" }, () => {
  const results = new Array(BATCH_SIZE);

  for (let i = 0; i < results.length; i++) {
    results[i] = cborx.encode(snapshot);
  }
}); */

/* Deno.bench("cbor2", { group: "decode" }, () => {
  const results = new Array(BATCH_SIZE);

  for (let i = 0; i < results.length; i++) {
    results[i] = cbor2.decode(snapshotData);
  }
}); */

Deno.bench("@char/cbor", { group: "decode" }, () => {
  const results = new Array(BATCH_SIZE);

  for (let i = 0; i < results.length; i++) {
    results[i] = decodeCBOR(snapshotData);
  }
});

Deno.bench("jsr @char/cbor", { group: "decode" }, () => {
  const results = new Array(BATCH_SIZE);

  for (let i = 0; i < results.length; i++) {
    results[i] = currCBOR.decodeCBOR(snapshotData);
  }
});

/* Deno.bench("cbor-x", { group: "decode" }, () => {
  const results = new Array(BATCH_SIZE);

  for (let i = 0; i < results.length; i++) {
    results[i] = cborx.decode(snapshotData);
  }
}); */

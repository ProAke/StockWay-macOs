import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boxFromScan,
  daysStored,
  seedBoxes,
  seedItems,
  status,
} from "../src/model.js";

const minute = 60_000;
const day = 1440 * minute;
const expiry = Date.UTC(2026, 10, 20, 13);
for (const reminder of [10, 15]) {
  test(`reminder enters the ${reminder}-minute window at its boundary`, () => {
    const item = { expiry: new Date(expiry).toISOString(), reminder };
    assert.equal(status(item, expiry - reminder * minute - 1), "good");
    assert.equal(status(item, expiry - reminder * minute), "soon");
    assert.equal(status(item, expiry - 1), "soon");
    assert.equal(status(item, expiry), "expired");
  });
}

test("items without a deadline are not marked expired", () => {
  assert.equal(status({ expiry: "", reminder: 15 }, expiry), "none");
});

test("storage age tracks start time and does not show negative days", () => {
  const item = { start: new Date(expiry - 4.5 * day).toISOString() };
  assert.equal(daysStored(item, expiry), 4);
  assert.equal(daysStored(item, expiry - 5 * day), 0);
});

test("QR payloads and manual codes resolve to the same box ID", () => {
  assert.equal(boxFromScan(" box-006 "), "BOX-006");
  assert.equal(boxFromScan("https://example.com/?box=box-006"), "BOX-006");
  assert.equal(boxFromScan("https://example.com/"), "");
});

test("all demo items reference a known box", () => {
  assert(
    seedItems(expiry).every((item) =>
      seedBoxes.some((box) => box.id === item.boxId),
    ),
  );
});

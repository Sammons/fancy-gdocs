import { test } from "node:test";
import assert from "node:assert/strict";
import { batchSplit } from "./batch.ts";

test("batchSplit 2500 default 1000 → 1000, 1000, 500", () => {
  const arr = Array.from({ length: 2500 }, (_, i) => ({ n: i }));
  const out = batchSplit(arr);
  assert.equal(out.length, 3);
  assert.equal(out[0].length, 1000);
  assert.equal(out[1].length, 1000);
  assert.equal(out[2].length, 500);
});

test("batchSplit empty → []", () => {
  assert.deepEqual(batchSplit([]), []);
});

test("batchSplit custom limit", () => {
  assert.equal(batchSplit([1, 2, 3, 4, 5] as unknown as Record<string, unknown>[], 2).length, 3);
});

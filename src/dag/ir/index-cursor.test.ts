import { test } from "node:test";
import assert from "node:assert/strict";
import { IndexCursor } from "./index-cursor.ts";

test("starts at the given origin (segment-relative)", () => {
  const cur = new IndexCursor(0);
  assert.equal(cur.getIndex(), 0);
  const cur2 = new IndexCursor(42);
  assert.equal(cur2.getIndex(), 42);
});

test("advance(n) moves the cursor forward", () => {
  const cur = new IndexCursor(0);
  cur.advance(5);
  assert.equal(cur.getIndex(), 5);
  cur.advance(3);
  assert.equal(cur.getIndex(), 8);
});

test("advance(0) is a no-op", () => {
  const cur = new IndexCursor(10);
  cur.advance(0);
  assert.equal(cur.getIndex(), 10);
});

test("advance rejects negative values (prevents silent corruption)", () => {
  const cur = new IndexCursor(5);
  assert.throws(() => cur.advance(-1), /negative/i);
});

test("withFixedIndex runs body at a pinned index without advancing the outer cursor", () => {
  const cur = new IndexCursor(100);
  let observed = -1;
  cur.withFixedIndex(42, () => {
    observed = cur.getIndex();
    cur.advance(10);
  });
  assert.equal(observed, 42, "body saw the pinned index");
  assert.equal(cur.getIndex(), 100, "outer cursor unchanged after scope exits");
});

test("withFixedIndex restores even when body throws", () => {
  const cur = new IndexCursor(100);
  assert.throws(() => {
    cur.withFixedIndex(42, () => {
      cur.advance(5);
      throw new Error("boom");
    });
  }, /boom/);
  assert.equal(cur.getIndex(), 100, "outer cursor unchanged after throw");
});

test("nested withFixedIndex scopes restore correctly (LIFO)", () => {
  const cur = new IndexCursor(100);
  const seen: number[] = [];
  cur.withFixedIndex(10, () => {
    seen.push(cur.getIndex());
    cur.withFixedIndex(20, () => {
      seen.push(cur.getIndex());
    });
    seen.push(cur.getIndex());
  });
  seen.push(cur.getIndex());
  assert.deepEqual(seen, [10, 20, 10, 100]);
});

test("reverse-order table cell insertion: 10x10 preserves correctness", () => {
  // Model: a 10x10 table's cells are inserted in reverse (last cell first).
  // Each cell insertion writes a fixed number of chars at a pinned index.
  // The outer cursor must NOT advance during the reverse pass.
  const startIdx = 50;
  const cur = new IndexCursor(startIdx);
  const numRows = 10;
  const numCols = 10;
  const writeLog: Array<{ cellIdx: number }> = [];
  const expectedWrites: number[] = [];

  for (let r = numRows - 1; r >= 0; r--) {
    for (let c = numCols - 1; c >= 0; c--) {
      const cellIdx = startIdx + 4 + r * (2 * numCols + 1) + c * 2;
      expectedWrites.push(cellIdx);
      cur.withFixedIndex(cellIdx, () => {
        writeLog.push({ cellIdx: cur.getIndex() });
      });
    }
  }

  assert.equal(writeLog.length, 100, "wrote 100 cells");
  assert.deepEqual(writeLog.map(w => w.cellIdx), expectedWrites);
  assert.equal(cur.getIndex(), startIdx, "outer cursor untouched by 100 fixed-index writes");
});

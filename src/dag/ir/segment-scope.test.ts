import { test } from "node:test";
import assert from "node:assert/strict";
import { SegmentScope } from "./segment-scope.ts";

test("starts with no segmentId and no tabId (body segment of default tab)", () => {
  const s = new SegmentScope();
  assert.equal(s.getSegmentId(), undefined);
  assert.equal(s.getTabId(), undefined);
});

test("locationFields() returns {} when both scopes are unset", () => {
  const s = new SegmentScope();
  assert.deepEqual(s.locationFields(), {});
});

test("locationFields() includes segmentId when set", () => {
  const s = new SegmentScope();
  s.push({ segmentId: "hdr.abc" });
  assert.deepEqual(s.locationFields(), { segmentId: "hdr.abc" });
});

test("locationFields() includes tabId when set", () => {
  const s = new SegmentScope();
  s.push({ tabId: "t.xyz" });
  assert.deepEqual(s.locationFields(), { tabId: "t.xyz" });
});

test("locationFields() includes both when both set", () => {
  const s = new SegmentScope();
  s.push({ segmentId: "hdr.abc", tabId: "t.xyz" });
  assert.deepEqual(s.locationFields(), { segmentId: "hdr.abc", tabId: "t.xyz" });
});

test("push/pop restores previous scope (LIFO)", () => {
  const s = new SegmentScope();
  s.push({ tabId: "t.1" });
  s.push({ segmentId: "hdr.1", tabId: "t.1" });
  assert.deepEqual(s.locationFields(), { segmentId: "hdr.1", tabId: "t.1" });
  s.pop();
  assert.deepEqual(s.locationFields(), { tabId: "t.1" });
  s.pop();
  assert.deepEqual(s.locationFields(), {});
});

test("pop on empty stack throws (prevents silent under-pop)", () => {
  const s = new SegmentScope();
  assert.throws(() => s.pop(), /pop/i);
});

test("withScope runs body with pushed scope and pops on return", () => {
  const s = new SegmentScope();
  let observed: Record<string, unknown> | undefined;
  s.withScope({ segmentId: "ftr.1" }, () => {
    observed = s.locationFields();
  });
  assert.deepEqual(observed, { segmentId: "ftr.1" });
  assert.deepEqual(s.locationFields(), {});
});

test("withScope pops on throw", () => {
  const s = new SegmentScope();
  assert.throws(() => {
    s.withScope({ segmentId: "err" }, () => { throw new Error("boom"); });
  }, /boom/);
  assert.deepEqual(s.locationFields(), {});
});

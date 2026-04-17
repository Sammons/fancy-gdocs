import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRequest } from "./doc-ir.ts";
import type { DocIR, Segment, SegmentRelativeRequest } from "./doc-ir.ts";

test("makeRequest returns { request, indexFields, namedStyleType } shape", () => {
  const req = { insertText: { location: { index: 5 }, text: "hi" } };
  const fields = ["insertText.location.index"];
  const out = makeRequest(req, fields);
  assert.deepEqual(out, { request: req, indexFields: fields, namedStyleType: undefined });
});

test("makeRequest accepts namedStyleType for theme application", () => {
  const req = { updateTextStyle: { textStyle: { bold: true } } };
  const out = makeRequest(req, [], "HEADING_1");
  assert.equal(out.namedStyleType, "HEADING_1");
});

test("makeRequest defaults indexFields to [] when omitted", () => {
  const req = { createNamedRange: { name: "x", range: { startIndex: 0, endIndex: 1 } } };
  const out = makeRequest(req);
  assert.deepEqual(out.indexFields, []);
  assert.equal(out.request, req);
});

test("makeRequest preserves reference identity of request payload (no clone)", () => {
  const req = { foo: { bar: 1 } };
  const out = makeRequest(req, []);
  assert.equal(out.request, req, "same object reference");
});

test("DocIR shape composes Segments with local + deferred request buckets", () => {
  const a: SegmentRelativeRequest = makeRequest({ a: 1 }, ["a"]);
  const b: SegmentRelativeRequest = makeRequest({ b: 2 }, []);
  const seg: Segment = {
    segmentId: "body",
    tabId: "tab-1",
    localRequests: [a],
    deferredRequests: [b],
  };
  const ir: DocIR = { segments: [seg] };
  assert.equal(ir.segments.length, 1);
  assert.equal(ir.segments[0]!.localRequests.length, 1);
  assert.equal(ir.segments[0]!.deferredRequests.length, 1);
});

test("Segment works without segmentId/tabId (default body segment)", () => {
  const seg: Segment = { localRequests: [], deferredRequests: [] };
  assert.equal(seg.segmentId, undefined);
  assert.equal(seg.tabId, undefined);
});

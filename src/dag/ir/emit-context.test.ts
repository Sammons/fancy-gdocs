import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "./emit-context.ts";
import { IndexCursor } from "./index-cursor.ts";
import { SegmentScope } from "./segment-scope.ts";
import { DocumentRegistry } from "./document-registry.ts";

test("EmitContext composes cursor + scope + registry", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  assert.ok(ctx.cursor instanceof IndexCursor);
  assert.ok(ctx.scope instanceof SegmentScope);
  assert.ok(ctx.registry instanceof DocumentRegistry);
});

test("pushRequest appends a segment-relative request to the current segment's localRequests", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  ctx.pushRequest({ insertText: { text: "hi", location: { index: 0 } } }, ["insertText.location.index"]);
  const docIR = ctx.buildIR();
  assert.equal(docIR.segments.length, 1);
  assert.equal(docIR.segments[0].localRequests.length, 1);
  assert.deepEqual(docIR.segments[0].localRequests[0].indexFields, ["insertText.location.index"]);
});

test("pushDeferred appends to the current segment's deferredRequests", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  ctx.pushDeferred({ insertText: { text: "x", location: { index: 5 } } }, ["insertText.location.index"]);
  const docIR = ctx.buildIR();
  assert.equal(docIR.segments[0].deferredRequests.length, 1);
  assert.equal(docIR.segments[0].localRequests.length, 0);
});

test("openSegment carries current scope into the new segment", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.scope.push({ segmentId: "hdr.1", tabId: "t.1" });
  ctx.openSegment();
  const docIR = ctx.buildIR();
  assert.equal(docIR.segments[0].segmentId, "hdr.1");
  assert.equal(docIR.segments[0].tabId, "t.1");
});

test("multiple openSegment calls create multiple segments", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  ctx.pushRequest({ a: 1 }, []);
  ctx.scope.push({ segmentId: "hdr" });
  ctx.openSegment();
  ctx.pushRequest({ b: 2 }, []);
  const docIR = ctx.buildIR();
  assert.equal(docIR.segments.length, 2);
  assert.deepEqual(docIR.segments[0].localRequests[0].request, { a: 1 });
  assert.deepEqual(docIR.segments[1].localRequests[0].request, { b: 2 });
});

test("pushRequest without an open segment throws (guards against stray emits)", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  assert.throws(() => ctx.pushRequest({ x: 1 }, []), /segment/i);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitCell } from "./cell.ts";

test("emitCell pushes deferred insertText + returns char count", () => {
  const ctx = new EmitContext(new IndexCursor(10), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  const n = emitCell({ kind: "cell", children: [{ kind: "paragraph", runs: [{ text: "hello" }] }] }, ctx, 0);
  assert.equal(n, 5);
  const ir = ctx.buildIR();
  assert.equal(ir.segments[0].deferredRequests.length, 1);
  assert.equal(ir.segments[0].localRequests.length, 0);
  const req = ir.segments[0].deferredRequests[0].request as any;
  assert.equal(req.insertText.text, "hello");
  assert.equal(req.insertText.location.index, 10);
});

test("emitCell styled run emits deferred updateTextStyle", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  emitCell({ kind: "cell", children: [{ kind: "paragraph", runs: [{ text: "x", bold: true }] }] }, ctx, 0);
  const d = ctx.buildIR().segments[0].deferredRequests;
  assert.equal(d.length, 2);
  assert.equal((d[1].request as any).updateTextStyle.textStyle.bold, true);
});

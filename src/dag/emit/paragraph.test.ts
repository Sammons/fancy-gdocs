import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitParagraph } from "./paragraph.ts";

function mkCtx(origin = 1) {
  const ctx = new EmitContext(new IndexCursor(origin), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  return ctx;
}

test("emitParagraph inserts runs + newline", () => {
  const ctx = mkCtx(1);
  emitParagraph({ kind: "paragraph", runs: [{ text: "hi" }] }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  assert.equal(reqs.length, 2); // insertText "hi", newline
  assert.equal(ctx.cursor.getIndex(), 4);
});

test("emitParagraph emits updateParagraphStyle for named style", () => {
  const ctx = mkCtx(0);
  emitParagraph({ kind: "paragraph", style: "HEADING_1", runs: [{ text: "Title" }], anchorId: "a1" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const last = reqs[reqs.length - 1].request as any;
  assert.equal(last.updateParagraphStyle.paragraphStyle.namedStyleType, "HEADING_1");
  assert.equal(last.updateParagraphStyle.range.startIndex, 0);
});

test("emitParagraph registers anchor + outline for headings", () => {
  const ctx = mkCtx(0);
  emitParagraph({ kind: "paragraph", style: "HEADING_2", runs: [{ text: "Sec" }], anchorId: "sec1" }, ctx);
  const anchor = ctx.registry.resolveAnchor("sec1");
  assert.equal(anchor?.index, 0);
  const outline = ctx.registry.getOutline();
  assert.equal(outline.length, 1);
  assert.equal(outline[0].level, 2);
  assert.equal(outline[0].text, "Sec");
});

test("emitParagraph skips paragraphStyle when no style fields set", () => {
  const ctx = mkCtx(0);
  emitParagraph({ kind: "paragraph", runs: [{ text: "x" }] }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  assert.equal(reqs.length, 2); // just insertText + newline
});

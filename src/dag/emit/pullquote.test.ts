import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitPullquote } from "./pullquote.ts";

function makeCtx(): EmitContext {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  return ctx;
}

test("emitPullquote classic style inserts opening quote char", () => {
  const ctx = makeCtx();
  emitPullquote({ kind: "pullquote", text: "Great things" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const first = reqs[0].request as { insertText: { text: string } };
  assert.ok(first.insertText.text.startsWith("\u201C")); // "
  assert.ok(first.insertText.text.includes("Great things"));
});

test("emitPullquote applies italic + large font to quote", () => {
  const ctx = makeCtx();
  emitPullquote({ kind: "pullquote", text: "Test" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const textStyle = reqs.find(
    (r) => (r.request as any).updateTextStyle?.textStyle?.italic === true,
  );
  assert.ok(textStyle, "should have italic text style");
  const ts = (textStyle!.request as any).updateTextStyle.textStyle;
  assert.equal(ts.fontSize.magnitude, 18); // classic style
});

test("emitPullquote applies centered alignment", () => {
  const ctx = makeCtx();
  emitPullquote({ kind: "pullquote", text: "Centered" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const paraStyle = reqs.find(
    (r) => (r.request as any).updateParagraphStyle?.paragraphStyle?.alignment === "CENTER",
  );
  assert.ok(paraStyle, "should have centered paragraph style");
});

test("emitPullquote applies left border", () => {
  const ctx = makeCtx();
  emitPullquote({ kind: "pullquote", text: "Border" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const paraStyle = reqs.find(
    (r) => (r.request as any).updateParagraphStyle?.paragraphStyle?.borderLeft,
  );
  assert.ok(paraStyle, "should have left border");
  const border = (paraStyle!.request as any).updateParagraphStyle.paragraphStyle.borderLeft;
  assert.equal(border.width.magnitude, 4); // classic style
});

test("emitPullquote with attribution adds second paragraph", () => {
  const ctx = makeCtx();
  emitPullquote({
    kind: "pullquote",
    text: "Quote text",
    attribution: "-- Author",
  }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  // Should have attribution text insert
  const attrInsert = reqs.find(
    (r) => (r.request as any).insertText?.text === "-- Author",
  );
  assert.ok(attrInsert, "should insert attribution text");
});

test("emitPullquote attribution is right-aligned", () => {
  const ctx = makeCtx();
  emitPullquote({
    kind: "pullquote",
    text: "Quote",
    attribution: "-- Author",
  }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const attrPara = reqs.find(
    (r) => (r.request as any).updateParagraphStyle?.paragraphStyle?.alignment === "END",
  );
  assert.ok(attrPara, "attribution should be right-aligned (END)");
});

test("emitPullquote modern style uses em dash prefix", () => {
  const ctx = makeCtx();
  emitPullquote({ kind: "pullquote", text: "Modern", style: "modern" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const first = reqs[0].request as { insertText: { text: string } };
  assert.ok(first.insertText.text.startsWith("\u2014 ")); // em dash + space
});

test("emitPullquote minimal style has no quote char", () => {
  const ctx = makeCtx();
  emitPullquote({ kind: "pullquote", text: "Minimal", style: "minimal" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const first = reqs[0].request as { insertText: { text: string } };
  assert.equal(first.insertText.text, "Minimal");
});

test("emitPullquote modern style uses smaller font", () => {
  const ctx = makeCtx();
  emitPullquote({ kind: "pullquote", text: "Small", style: "modern" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const textStyle = reqs.find(
    (r) => (r.request as any).updateTextStyle?.textStyle?.italic === true,
  );
  const ts = (textStyle!.request as any).updateTextStyle.textStyle;
  assert.equal(ts.fontSize.magnitude, 16); // modern style
});

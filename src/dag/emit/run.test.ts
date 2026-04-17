import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitRuns } from "./run.ts";

function mkCtx(origin = 1) {
  const ctx = new EmitContext(new IndexCursor(origin), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  return ctx;
}

test("emitRuns inserts text and returns end index", () => {
  const ctx = mkCtx(1);
  const end = emitRuns([{ text: "hello" }], 1, ctx);
  assert.equal(end, 6);
  const ir = ctx.buildIR();
  const reqs = ir.segments[0].localRequests;
  assert.equal(reqs.length, 1);
  assert.deepEqual(reqs[0].request, { insertText: { text: "hello", location: { index: 1 } } });
  assert.deepEqual(reqs[0].indexFields, ["insertText.location.index"]);
  assert.equal(ctx.cursor.getIndex(), 6);
});

test("emitRuns applies updateTextStyle for styled run", () => {
  const ctx = mkCtx(0);
  emitRuns([{ text: "bold", bold: true }], 0, ctx);
  const seg = ctx.buildIR().segments[0];
  // insertText goes to localRequests
  assert.equal(seg.localRequests.length, 1);
  // updateTextStyle goes to deferredRequests (applied after paragraph styles)
  assert.equal(seg.deferredRequests.length, 1);
  const styleReq = seg.deferredRequests[0].request as any;
  assert.equal(styleReq.updateTextStyle.textStyle.bold, true);
  assert.equal(styleReq.updateTextStyle.range.startIndex, 0);
  assert.equal(styleReq.updateTextStyle.range.endIndex, 4);
  assert.deepEqual(seg.deferredRequests[0].indexFields, [
    "updateTextStyle.range.startIndex",
    "updateTextStyle.range.endIndex",
  ]);
});

test("emitRuns concatenates multiple runs", () => {
  const ctx = mkCtx(5);
  const end = emitRuns([{ text: "ab" }, { text: "cd", italic: true }], 5, ctx);
  assert.equal(end, 9);
  const seg = ctx.buildIR().segments[0];
  // two inserts in localRequests
  assert.equal(seg.localRequests.length, 2);
  // one style in deferredRequests
  assert.equal(seg.deferredRequests.length, 1);
});

test("emitRuns supports link, color, fontSize", () => {
  const ctx = mkCtx(0);
  emitRuns([{ text: "x", link: "https://a", color: "#FF0000", fontSize: 14 }], 0, ctx);
  // updateTextStyle is deferred
  const styleReq = ctx.buildIR().segments[0].deferredRequests[0].request as any;
  const ts = styleReq.updateTextStyle.textStyle;
  assert.equal(ts.link.url, "https://a");
  assert.ok(ts.foregroundColor);
  assert.equal(ts.fontSize.magnitude, 14);
});

// --------------------------------------------------------------------------
// Footnote emission tests
// --------------------------------------------------------------------------

test("emitRuns registers footnote with DocumentRegistry", () => {
  const ctx = mkCtx(10);
  emitRuns([{ text: "See", footnote: { runs: [{ text: "A note" }] } }], 10, ctx);
  // Footnotes should be collected via registry.getPendingFootnotes()
  const footnotes = ctx.registry.getPendingFootnotes();
  assert.equal(footnotes.length, 1);
  assert.equal(footnotes[0].bodyIndex, 13); // after "See" text
  assert.deepEqual(footnotes[0].content, [{ text: "A note" }]);
});

test("emitRuns assigns sequential footnote numbers", () => {
  const ctx = mkCtx(0);
  emitRuns([
    { text: "A", footnote: { runs: [{ text: "fn1" }] } },
    { text: "B", footnote: { runs: [{ text: "fn2" }] } },
  ], 0, ctx);
  const footnotes = ctx.registry.getPendingFootnotes();
  assert.equal(footnotes.length, 2);
  assert.equal(footnotes[0].footnoteNumber, 1);
  assert.equal(footnotes[1].footnoteNumber, 2);
});

test("emitRuns does not advance cursor for footnote marker (deferred)", () => {
  const ctx = mkCtx(0);
  // Footnote marker is deferred - the +1 for footnote ref char happens
  // when createFootnote is executed, not during run emission.
  const end = emitRuns([{ text: "x", footnote: { runs: [{ text: "note" }] } }], 0, ctx);
  // "x" is inserted (len 1), footnote marker NOT inserted yet
  assert.equal(end, 1);
  assert.equal(ctx.cursor.getIndex(), 1);
});

test("emitRuns captures tabId in footnote spec", () => {
  const scope = new SegmentScope();
  scope.push({ tabId: "tab-2" });
  const ctx = new EmitContext(new IndexCursor(0), scope, new DocumentRegistry());
  ctx.openSegment();
  emitRuns([{ text: "", footnote: { runs: [{ text: "fn" }] } }], 0, ctx);
  const footnotes = ctx.registry.getPendingFootnotes();
  assert.equal(footnotes[0].tabId, "tab-2");
});

test("emitRuns handles footnote with styled inner runs", () => {
  const ctx = mkCtx(0);
  emitRuns([{ text: "ref", footnote: { runs: [{ text: "bold", bold: true }] } }], 0, ctx);
  const footnotes = ctx.registry.getPendingFootnotes();
  assert.equal(footnotes[0].content[0].bold, true);
});

test("emitRuns processes run text before registering footnote", () => {
  // The footnote marker appears at the end of the run's text
  const ctx = mkCtx(5);
  emitRuns([{ text: "abc", footnote: { runs: [{ text: "note" }] } }], 5, ctx);
  const footnotes = ctx.registry.getPendingFootnotes();
  assert.equal(footnotes[0].bodyIndex, 8); // 5 + 3 ("abc")
});

// --------------------------------------------------------------------------
// Anchor link emission tests
// --------------------------------------------------------------------------

test("emitRuns registers pending anchor link for link starting with #", () => {
  const ctx = mkCtx(10);
  emitRuns([{ text: "See intro", link: "#intro" }], 10, ctx);
  const links = ctx.registry.getPendingAnchorLinks();
  assert.equal(links.length, 1);
  assert.deepEqual(links[0], {
    range: { startIndex: 10, endIndex: 19 },
    anchorName: "intro",
    tabId: undefined,
  });
});

test("emitRuns does NOT emit updateTextStyle.link for anchor links", () => {
  const ctx = mkCtx(0);
  // Run with anchor link should only insert text + register pending link
  // No updateTextStyle for link field
  emitRuns([{ text: "click", link: "#section" }], 0, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  // Should only have 1 request: insertText (no updateTextStyle for link)
  assert.equal(reqs.length, 1);
  assert.ok("insertText" in reqs[0].request);
});

test("emitRuns emits other styles even when link is anchor", () => {
  const ctx = mkCtx(0);
  // Run with anchor link + bold should emit updateTextStyle for bold only
  emitRuns([{ text: "click", link: "#section", bold: true }], 0, ctx);
  const seg = ctx.buildIR().segments[0];
  assert.equal(seg.localRequests.length, 1); // insertText only
  assert.equal(seg.deferredRequests.length, 1); // updateTextStyle (for bold, not link)
  const styleReq = seg.deferredRequests[0].request as any;
  assert.equal(styleReq.updateTextStyle.textStyle.bold, true);
  assert.equal(styleReq.updateTextStyle.textStyle.link, undefined);
  assert.equal(styleReq.updateTextStyle.fields, "bold");
});

test("emitRuns captures tabId in pending anchor link", () => {
  const scope = new SegmentScope();
  scope.push({ tabId: "tab-3" });
  const ctx = new EmitContext(new IndexCursor(0), scope, new DocumentRegistry());
  ctx.openSegment();
  emitRuns([{ text: "link", link: "#heading" }], 0, ctx);
  const links = ctx.registry.getPendingAnchorLinks();
  assert.equal(links[0].tabId, "tab-3");
});

test("emitRuns handles anchorId object link (already resolved - Google ID)", () => {
  const ctx = mkCtx(0);
  // link: { anchorId: "h.xxx" } is a Google-assigned heading ID - emit directly
  emitRuns([{ text: "ref", link: { anchorId: "h.abc123" } }], 0, ctx);
  const seg = ctx.buildIR().segments[0];
  assert.equal(seg.localRequests.length, 1); // insertText
  assert.equal(seg.deferredRequests.length, 1); // updateTextStyle
  const styleReq = seg.deferredRequests[0].request as any;
  assert.deepEqual(styleReq.updateTextStyle.textStyle.link, { headingId: "h.abc123" });
  // Should NOT be registered as pending anchor link
  assert.equal(ctx.registry.getPendingAnchorLinks().length, 0);
});

test("emitRuns handles anchorId object link (user-defined - needs resolution)", () => {
  const ctx = mkCtx(0);
  // link: { anchorId: "section1" } is user-defined - defer to phase-2
  emitRuns([{ text: "go to section", link: { anchorId: "section1" } }], 0, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  // Only insertText - no updateTextStyle for link (deferred)
  assert.equal(reqs.length, 1);
  // Should be registered as pending anchor link
  const links = ctx.registry.getPendingAnchorLinks();
  assert.equal(links.length, 1);
  assert.equal(links[0].anchorName, "section1");
  assert.deepEqual(links[0].range, { startIndex: 0, endIndex: 13 });
});

test("emitRuns handles regular URL links (not anchor)", () => {
  const ctx = mkCtx(0);
  emitRuns([{ text: "google", link: "https://google.com" }], 0, ctx);
  const seg = ctx.buildIR().segments[0];
  assert.equal(seg.localRequests.length, 1); // insertText
  assert.equal(seg.deferredRequests.length, 1); // updateTextStyle
  const styleReq = seg.deferredRequests[0].request as any;
  assert.deepEqual(styleReq.updateTextStyle.textStyle.link, { url: "https://google.com" });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitCallout } from "./callout.ts";

test("emitCallout INFO preset wraps range with borderLeft + shading", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  emitCallout({
    kind: "callout",
    preset: "INFO",
    children: [{ kind: "paragraph", runs: [{ text: "note" }] }],
  }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const last = reqs[reqs.length - 1].request as any;
  assert.equal(last.updateParagraphStyle.range.startIndex, 0);
  assert.ok(last.updateParagraphStyle.paragraphStyle.borderLeft);
  assert.ok(last.updateParagraphStyle.paragraphStyle.shading);
});

test("emitCallout rejects non-paragraph children", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  assert.throws(() => emitCallout({
    kind: "callout",
    children: [{ kind: "hr" }],
  }, ctx), /callout children/);
});

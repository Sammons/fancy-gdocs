import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitBlockquote } from "./blockquote.ts";

test("emitBlockquote applies indent + borderLeft", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  emitBlockquote({
    kind: "blockquote",
    children: [{ kind: "paragraph", runs: [{ text: "quoted" }] }],
  }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const last = reqs[reqs.length - 1].request as any;
  assert.equal(last.updateParagraphStyle.paragraphStyle.indentStart.magnitude, 36);
  assert.ok(last.updateParagraphStyle.paragraphStyle.borderLeft);
});

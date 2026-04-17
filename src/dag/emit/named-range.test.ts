import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitNamedRange } from "./named-range.ts";

test("emitNamedRange wraps children with createNamedRange", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  emitNamedRange({
    kind: "namedRange",
    name: "summary",
    children: [{ kind: "paragraph", runs: [{ text: "hi" }] }],
  }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const last = reqs[reqs.length - 1].request as any;
  assert.equal(last.createNamedRange.name, "summary");
  assert.equal(last.createNamedRange.range.startIndex, 0);
  assert.equal(last.createNamedRange.range.endIndex, 3); // "hi" + \n
});

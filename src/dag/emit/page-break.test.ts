import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitPageBreak } from "./page-break.ts";

test("emitPageBreak inserts page break + advances 2", () => {
  const ctx = new EmitContext(new IndexCursor(3), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  emitPageBreak({ kind: "pageBreak" }, ctx);
  const r = ctx.buildIR().segments[0].localRequests[0];
  assert.deepEqual(r.request, { insertPageBreak: { location: { index: 3 } } });
  assert.deepEqual(r.indexFields, ["insertPageBreak.location.index"]);
  assert.equal(ctx.cursor.getIndex(), 5);
});

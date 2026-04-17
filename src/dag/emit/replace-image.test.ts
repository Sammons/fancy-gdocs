import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitReplaceImage } from "./replace-image.ts";

test("emitReplaceImage emits replaceImage by objectId", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  emitReplaceImage({ kind: "replaceImage", objectId: "oid.1", uri: "https://x/y.png" }, ctx);
  const r = ctx.buildIR().segments[0].localRequests[0];
  assert.deepEqual(r.request, { replaceImage: { imageObjectId: "oid.1", uri: "https://x/y.png" } });
  assert.deepEqual(r.indexFields, []);
});

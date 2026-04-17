import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitImage } from "./image.ts";

function mkCtx(o = 5) {
  const ctx = new EmitContext(new IndexCursor(o), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  return ctx;
}

test("emitImage emits insertInlineImage with size + advances 1", () => {
  const ctx = mkCtx(5);
  emitImage({ kind: "image", uri: "https://a/x.png", width: 100, height: 50 }, ctx);
  const r = ctx.buildIR().segments[0].localRequests[0];
  const req = r.request as any;
  assert.equal(req.insertInlineImage.uri, "https://a/x.png");
  assert.equal(req.insertInlineImage.location.index, 5);
  assert.equal(req.insertInlineImage.objectSize.width.magnitude, 100);
  assert.deepEqual(r.indexFields, ["insertInlineImage.location.index"]);
  assert.equal(ctx.cursor.getIndex(), 6);
});

test("emitImage omits objectSize when no width/height", () => {
  const ctx = mkCtx(0);
  emitImage({ kind: "image", uri: "u" }, ctx);
  const req = ctx.buildIR().segments[0].localRequests[0].request as any;
  assert.equal(req.insertInlineImage.objectSize, undefined);
});

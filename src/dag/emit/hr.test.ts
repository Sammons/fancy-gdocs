import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitHr } from "./hr.ts";

test("emitHr inserts newline + border-bottom style, advances 1", () => {
  const ctx = new EmitContext(new IndexCursor(2), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  emitHr({ kind: "hr" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  assert.equal(reqs.length, 2);
  assert.equal((reqs[0].request as any).insertText.text, "\n");
  const ups = (reqs[1].request as any).updateParagraphStyle;
  assert.equal(ups.range.startIndex, 2);
  assert.equal(ups.range.endIndex, 3);
  assert.ok(ups.paragraphStyle.borderBottom);
  assert.equal(ctx.cursor.getIndex(), 3);
});

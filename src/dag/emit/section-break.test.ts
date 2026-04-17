import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitSectionBreak } from "./section-break.ts";

function mkCtx(o = 0) {
  const ctx = new EmitContext(new IndexCursor(o), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  return ctx;
}

test("emitSectionBreak: bare", () => {
  const ctx = mkCtx(4);
  emitSectionBreak({ kind: "sectionBreak" }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  assert.equal(reqs.length, 1);
  const req = reqs[0].request as any;
  assert.equal(req.insertSectionBreak.sectionType, "NEXT_PAGE");
  assert.equal(req.insertSectionBreak.location.index, 4);
  assert.equal(ctx.cursor.getIndex(), 6);
});

test("emitSectionBreak: landscape + 2 columns", () => {
  const ctx = mkCtx(0);
  emitSectionBreak({ kind: "sectionBreak", orientation: "LANDSCAPE", columns: 2 }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  assert.equal(reqs.length, 2);
  const uss = (reqs[1].request as any).updateSectionStyle;
  assert.equal(uss.sectionStyle.flipPageOrientation, true);
  assert.equal(uss.sectionStyle.columnProperties.length, 2);
});

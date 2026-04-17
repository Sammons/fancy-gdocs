import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitList } from "./list.ts";

function mkCtx(o = 0) {
  const ctx = new EmitContext(new IndexCursor(o), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  return ctx;
}

test("emitList BULLET — two items", () => {
  const ctx = mkCtx(0);
  emitList({
    kind: "list",
    style: "BULLET",
    items: [
      [{ kind: "paragraph", runs: [{ text: "a" }] }],
      [{ kind: "paragraph", runs: [{ text: "b" }] }],
    ],
  }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  // 2 insertText "a" + 2 newline + 2 insertText "b" + newline = actually: a, \n, b, \n, bullets
  const last = reqs[reqs.length - 1].request as any;
  assert.equal(last.createParagraphBullets.bulletPreset, "BULLET_DISC_CIRCLE_SQUARE");
  assert.equal(last.createParagraphBullets.range.startIndex, 0);
  // 2 + 1 + 2 + 1 = cursor at 4; bullets end = 3
  assert.equal(last.createParagraphBullets.range.endIndex, 3);
});

test("emitList NUMBERED preset", () => {
  const ctx = mkCtx(0);
  emitList({
    kind: "list",
    style: "NUMBERED",
    items: [[{ kind: "paragraph", runs: [{ text: "x" }] }]],
  }, ctx);
  const reqs = ctx.buildIR().segments[0].localRequests;
  const last = reqs[reqs.length - 1].request as any;
  assert.equal(last.createParagraphBullets.bulletPreset, "NUMBERED_DECIMAL_ALPHA_ROMAN");
});

test("emitList rejects nested multi-block items", () => {
  const ctx = mkCtx(0);
  assert.throws(() => emitList({
    kind: "list",
    style: "BULLET",
    items: [[
      { kind: "paragraph", runs: [{ text: "a" }] },
      { kind: "paragraph", runs: [{ text: "b" }] },
    ]],
  }, ctx), /nested list content/);
});

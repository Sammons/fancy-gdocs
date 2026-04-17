import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { collect } from "./collect.ts";
import type { Block } from "../types/block.ts";

test("collect is a no-op for all block kinds", () => {
  // Use IndexCursor(0) for segment-relative indices (rebase adds origin)
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  const blocks: Block[] = [
    { kind: "paragraph", runs: [{ text: "x" }], anchorId: "a1" },
    { kind: "image", uri: "u" },
    { kind: "hr" },
    { kind: "pageBreak" },
  ];
  for (const b of blocks) collect(b, ctx);
  const ir = ctx.buildIR();
  assert.equal(ir.segments[0].localRequests.length, 0);
  assert.equal(ir.segments[0].deferredRequests.length, 0);
  assert.equal(ctx.registry.resolveAnchor("a1"), undefined);
});

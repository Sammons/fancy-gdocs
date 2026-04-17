import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { dispatch } from "./index.ts";
import type { Block } from "../types/block.ts";

function run(block: Block) {
  // Use IndexCursor(0) for segment-relative indices (rebase adds origin)
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  dispatch(block, ctx);
  return ctx.buildIR();
}

test("dispatch routes paragraph", () => {
  const ir = run({ kind: "paragraph", runs: [{ text: "p" }] });
  const r0 = ir.segments[0].localRequests[0].request as any;
  assert.equal(r0.insertText.text, "p");
});

test("dispatch routes image, pageBreak, hr, sectionBreak, list, table, callout, blockquote, replaceText, replaceImage, namedRange", () => {
  const kinds: Block[] = [
    { kind: "image", uri: "u" },
    { kind: "pageBreak" },
    { kind: "hr" },
    { kind: "sectionBreak" },
    { kind: "list", style: "BULLET", items: [[{ kind: "paragraph", runs: [{ text: "i" }] }]] },
    { kind: "table", rows: [[{ kind: "cell", children: [{ kind: "paragraph", runs: [{ text: "c" }] }] }]] },
    { kind: "callout", children: [{ kind: "paragraph", runs: [{ text: "c" }] }] },
    { kind: "blockquote", children: [{ kind: "paragraph", runs: [{ text: "q" }] }] },
    { kind: "replaceText", search: "s", replace: "r" },
    { kind: "replaceImage", objectId: "o", uri: "u" },
    { kind: "namedRange", name: "n", children: [{ kind: "paragraph", runs: [{ text: "x" }] }] },
  ];
  for (const k of kinds) {
    const ir = run(k);
    assert.ok(ir.segments[0].localRequests.length + ir.segments[0].deferredRequests.length > 0, `no requests for ${k.kind}`);
  }
});

test("dispatch throws on unknown kind", () => {
  assert.throws(() => run({ kind: "bogus" } as unknown as Block));
});

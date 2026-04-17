import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { walk } from "./walk.ts";
import type { DocSpec } from "../types/doc-spec.ts";

function mkCtx() {
  // Use IndexCursor(0) for segment-relative indices (rebase adds origin)
  return new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
}

test("walk single-tab DocSpec → 1 segment with requests", () => {
  const ctx = mkCtx();
  const spec: DocSpec = {
    title: "t", account: "a",
    blocks: [
      { kind: "paragraph", runs: [{ text: "one" }] },
      { kind: "paragraph", runs: [{ text: "two" }] },
    ],
  };
  walk(spec, ctx);
  const ir = ctx.buildIR();
  assert.equal(ir.segments.length, 1);
  assert.ok(ir.segments[0].localRequests.length >= 4);
});

test("walk multi-tab DocSpec → one segment per tab", () => {
  const ctx = mkCtx();
  const spec: DocSpec = {
    title: "t", account: "a",
    tabs: [
      { title: "T1", blocks: [{ kind: "paragraph", runs: [{ text: "a" }] }] },
      { title: "T2", blocks: [{ kind: "paragraph", runs: [{ text: "b" }] }] },
    ],
  };
  walk(spec, ctx);
  const ir = ctx.buildIR();
  assert.equal(ir.segments.length, 2);
});

test("walk with docStyle emits updateDocumentStyle", () => {
  const ctx = mkCtx();
  walk({ title: "t", account: "a", blocks: [], docStyle: { marginTop: 72 } }, ctx);
  const ir = ctx.buildIR();
  const uds = ir.segments[0].localRequests.find((r) => (r.request as any).updateDocumentStyle);
  assert.ok(uds);
});

test("walk with header creates header + segment", () => {
  const ctx = mkCtx();
  walk({
    title: "t", account: "a",
    blocks: [{ kind: "paragraph", runs: [{ text: "body" }] }],
    header: { blocks: [{ kind: "paragraph", runs: [{ text: "hdr" }] }] },
  }, ctx);
  const ir = ctx.buildIR();
  // body + header segment
  assert.equal(ir.segments.length, 2);
  // createHeader request landed somewhere
  const all = ir.segments.flatMap((s) => s.localRequests);
  const ch = all.find((r) => (r.request as any).createHeader);
  assert.ok(ch);
});

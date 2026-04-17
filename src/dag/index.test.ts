import { test } from "node:test";
import assert from "node:assert/strict";
import { compileDoc } from "./index.ts";
import type { DocSpec } from "./types/doc-spec.ts";

test("compileDoc end-to-end: title + paragraphs + image + 2x2 table", () => {
  const spec: DocSpec = {
    title: "Smoke", account: "a",
    blocks: [
      { kind: "paragraph", style: "TITLE", runs: [{ text: "Title" }] },
      { kind: "paragraph", runs: [{ text: "First paragraph" }] },
      { kind: "paragraph", runs: [{ text: "Second paragraph" }] },
      { kind: "image", uri: "https://example.com/img.png" },
      { kind: "table", rows: [
        [
          { kind: "cell", children: [{ kind: "paragraph", runs: [{ text: "a" }] }] },
          { kind: "cell", children: [{ kind: "paragraph", runs: [{ text: "b" }] }] },
        ],
        [
          { kind: "cell", children: [{ kind: "paragraph", runs: [{ text: "c" }] }] },
          { kind: "cell", children: [{ kind: "paragraph", runs: [{ text: "d" }] }] },
        ],
      ] },
    ],
  };
  const { ir } = compileDoc(spec);
  assert.equal(ir.segments.length, 1);
  assert.ok(ir.segments[0].localRequests.length > 0);
  assert.ok(ir.segments[0].deferredRequests.length > 0);
});

test("compileDoc with theme applies defaults", () => {
  const { ir } = compileDoc(
    { title: "t", account: "a", blocks: [{ kind: "paragraph", runs: [{ text: "hi", bold: true }] }] },
    { fontFamily: "Inter" },
  );
  // updateTextStyle is emitted as a deferredRequest (applied after paragraph styles)
  const uts = ir.segments[0].deferredRequests.find((r) => (r.request as any).updateTextStyle);
  assert.ok(uts, "expected updateTextStyle in deferredRequests");
  const ts = (uts!.request as any).updateTextStyle.textStyle;
  assert.equal(ts.weightedFontFamily.fontFamily, "Inter");
});

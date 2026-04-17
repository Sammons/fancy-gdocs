import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocSpec, TabSpec, HeaderFooterSpec, DocStyleSpec } from "./doc-spec.ts";

test("DocSpec minimal requires title + account", () => {
  const d: DocSpec = { title: "T", account: "ben@sammons.io" };
  assert.equal(d.title, "T");
  assert.equal(d.account, "ben@sammons.io");
});

test("DocSpec supports multi-tab documents", () => {
  const tab: TabSpec = { title: "Intro", icon: "📘", blocks: [{ kind: "hr" }] };
  const d: DocSpec = { title: "T", account: "a", tabs: [tab] };
  assert.equal(d.tabs?.[0]?.title, "Intro");
});

test("DocSpec supports top-level blocks (single-tab shape)", () => {
  const d: DocSpec = { title: "T", account: "a", blocks: [{ kind: "pageBreak" }] };
  assert.equal(d.blocks?.length, 1);
});

test("DocStyleSpec carries margins, size, orientation, background", () => {
  const s: DocStyleSpec = {
    marginTop: 72,
    marginBottom: 72,
    marginLeft: 72,
    marginRight: 72,
    size: "LETTER",
    orientation: "PORTRAIT",
    background: "#ffffff",
  };
  assert.equal(s.size, "LETTER");
});

test("HeaderFooterSpec wraps blocks for header/footer/firstPage*", () => {
  const hf: HeaderFooterSpec = { blocks: [{ kind: "hr" }] };
  const d: DocSpec = {
    title: "T",
    account: "a",
    header: hf,
    footer: hf,
    firstPageHeader: hf,
    firstPageFooter: hf,
  };
  assert.equal(d.header?.blocks.length, 1);
  assert.equal(d.firstPageFooter?.blocks.length, 1);
});

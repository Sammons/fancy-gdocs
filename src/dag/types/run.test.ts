import { test } from "node:test";
import assert from "node:assert/strict";
import type { Run } from "./run.ts";

test("Run type accepts minimal shape (text only)", () => {
  const r: Run = { text: "hello" };
  assert.equal(r.text, "hello");
});

test("Run type accepts full styling", () => {
  const r: Run = {
    text: "x",
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    color: "#ff0000",
    backgroundColor: "#00ff00",
    fontSize: 12,
    fontFamily: "Arial",
    superscript: true,
    subscript: false,
  };
  assert.equal(r.bold, true);
  assert.equal(r.color, "#ff0000");
});

test("Run.link accepts URL string or anchor object", () => {
  const urlRun: Run = { text: "a", link: "https://x.com" };
  const anchorRun: Run = { text: "b", link: { anchorId: "anchor-1" } };
  assert.equal(urlRun.link, "https://x.com");
  assert.deepEqual(anchorRun.link, { anchorId: "anchor-1" });
});

test("Run.footnote nests runs recursively", () => {
  const r: Run = {
    text: "note",
    footnote: { runs: [{ text: "inner", bold: true }] },
  };
  assert.equal(r.footnote?.runs[0]?.text, "inner");
});

test("Run.date and Run.mention smart-chip shapes", () => {
  const d: Run = { text: "", date: { isoDate: "2026-04-12" } };
  const m: Run = { text: "", mention: { email: "ben@sammons.io" } };
  assert.equal(d.date?.isoDate, "2026-04-12");
  assert.equal(m.mention?.email, "ben@sammons.io");
});

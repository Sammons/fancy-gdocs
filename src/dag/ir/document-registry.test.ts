import { test } from "node:test";
import assert from "node:assert/strict";
import { DocumentRegistry } from "./document-registry.ts";

test("anchors: register + resolve round-trip", () => {
  const reg = new DocumentRegistry();
  reg.registerAnchor("intro", { segmentId: undefined, tabId: "t.1", index: 42 });
  const loc = reg.resolveAnchor("intro");
  assert.deepEqual(loc, { segmentId: undefined, tabId: "t.1", index: 42 });
});

test("anchors: unknown id returns undefined (callers decide if error)", () => {
  const reg = new DocumentRegistry();
  assert.equal(reg.resolveAnchor("missing"), undefined);
});

test("anchors: duplicate id throws (prevents silent overwrite of link targets)", () => {
  const reg = new DocumentRegistry();
  reg.registerAnchor("a", { index: 1 });
  assert.throws(() => reg.registerAnchor("a", { index: 2 }), /duplicate/i);
});

test("heading outline: append in order, returns captured entries", () => {
  const reg = new DocumentRegistry();
  reg.addOutlineEntry({ level: 1, text: "Chapter 1", anchorId: "c1" });
  reg.addOutlineEntry({ level: 2, text: "Section A", anchorId: "s1" });
  reg.addOutlineEntry({ level: 1, text: "Chapter 2", anchorId: "c2" });
  assert.deepEqual(reg.getOutline(), [
    { level: 1, text: "Chapter 1", anchorId: "c1" },
    { level: 2, text: "Section A", anchorId: "s1" },
    { level: 1, text: "Chapter 2", anchorId: "c2" },
  ]);
});

test("footnote counter: nextFootnoteNumber increments from 1", () => {
  const reg = new DocumentRegistry();
  assert.equal(reg.nextFootnoteNumber(), 1);
  assert.equal(reg.nextFootnoteNumber(), 2);
  assert.equal(reg.nextFootnoteNumber(), 3);
});

test("numbering: per-list counter increments, reset on new list id", () => {
  const reg = new DocumentRegistry();
  assert.equal(reg.nextListItem("a"), 1);
  assert.equal(reg.nextListItem("a"), 2);
  assert.equal(reg.nextListItem("b"), 1);
  assert.equal(reg.nextListItem("a"), 3);
  reg.resetList("a");
  assert.equal(reg.nextListItem("a"), 1);
});

test("fresh registry: outline empty, no anchors, counters at 0", () => {
  const reg = new DocumentRegistry();
  assert.deepEqual(reg.getOutline(), []);
  assert.equal(reg.resolveAnchor("anything"), undefined);
  assert.equal(reg.nextFootnoteNumber(), 1);
});

test("footnotes: registerFootnote stores spec with auto-incremented number", () => {
  const reg = new DocumentRegistry();
  const fn1 = reg.registerFootnote(10, [{ text: "note 1" }], "tab-1");
  const fn2 = reg.registerFootnote(20, [{ text: "note 2", bold: true }]);
  assert.equal(fn1.footnoteNumber, 1);
  assert.equal(fn1.bodyIndex, 10);
  assert.equal(fn1.tabId, "tab-1");
  assert.deepEqual(fn1.content, [{ text: "note 1" }]);
  assert.equal(fn2.footnoteNumber, 2);
  assert.equal(fn2.bodyIndex, 20);
  assert.equal(fn2.tabId, undefined);
});

test("footnotes: getPendingFootnotes returns all registered footnotes", () => {
  const reg = new DocumentRegistry();
  reg.registerFootnote(5, [{ text: "a" }]);
  reg.registerFootnote(15, [{ text: "b" }]);
  const all = reg.getPendingFootnotes();
  assert.equal(all.length, 2);
  assert.equal(all[0].bodyIndex, 5);
  assert.equal(all[1].bodyIndex, 15);
});

test("footnotes: getPendingFootnotes returns copy (no mutation)", () => {
  const reg = new DocumentRegistry();
  reg.registerFootnote(1, [{ text: "x" }]);
  const list = reg.getPendingFootnotes();
  list.push({ bodyIndex: 99, content: [], footnoteNumber: 99 });
  assert.equal(reg.getPendingFootnotes().length, 1);
});

// --------------------------------------------------------------------------
// Pending anchor link tests
// --------------------------------------------------------------------------

test("pendingAnchorLinks: registerPendingAnchorLink stores link", () => {
  const reg = new DocumentRegistry();
  reg.registerPendingAnchorLink({
    range: { startIndex: 10, endIndex: 15 },
    anchorName: "intro",
    tabId: "t.1",
  });
  const links = reg.getPendingAnchorLinks();
  assert.equal(links.length, 1);
  assert.deepEqual(links[0], {
    range: { startIndex: 10, endIndex: 15 },
    anchorName: "intro",
    tabId: "t.1",
  });
});

test("pendingAnchorLinks: multiple links accumulate", () => {
  const reg = new DocumentRegistry();
  reg.registerPendingAnchorLink({ range: { startIndex: 5, endIndex: 10 }, anchorName: "a" });
  reg.registerPendingAnchorLink({ range: { startIndex: 20, endIndex: 25 }, anchorName: "b" });
  const links = reg.getPendingAnchorLinks();
  assert.equal(links.length, 2);
  assert.equal(links[0].anchorName, "a");
  assert.equal(links[1].anchorName, "b");
});

test("pendingAnchorLinks: getPendingAnchorLinks returns copy (no mutation)", () => {
  const reg = new DocumentRegistry();
  reg.registerPendingAnchorLink({ range: { startIndex: 0, endIndex: 5 }, anchorName: "x" });
  const list = reg.getPendingAnchorLinks();
  list.push({ range: { startIndex: 99, endIndex: 100 }, anchorName: "y" });
  assert.equal(reg.getPendingAnchorLinks().length, 1);
});

test("pendingAnchorLinks: fresh registry has no pending links", () => {
  const reg = new DocumentRegistry();
  assert.deepEqual(reg.getPendingAnchorLinks(), []);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  Block,
  ParagraphNode,
  TableNode,
  CellNode,
  ListNode,
  CalloutNode,
  BlockquoteNode,
  NamedRangeNode,
  SectionBreakNode,
  ReplaceTextNode,
  ReplaceImageNode,
  ImageNode,
  PageBreakNode,
  HrNode,
  PullQuoteNode,
} from "./block.ts";

test("ParagraphNode discriminated by kind:'paragraph'", () => {
  const p: ParagraphNode = { kind: "paragraph", runs: [{ text: "hi" }] };
  assert.equal(p.kind, "paragraph");
});

test("ListNode holds Block[][] for items (nestable sequences)", () => {
  const nested: ListNode = {
    kind: "list",
    style: "BULLET",
    items: [[{ kind: "paragraph", runs: [{ text: "a" }] }]],
  };
  assert.equal(nested.items.length, 1);
  assert.equal(nested.items[0]!.length, 1);
});

test("TableNode uses CellNode[][] with optional merges", () => {
  const cell: CellNode = { kind: "cell", children: [] };
  const t: TableNode = {
    kind: "table",
    rows: [[cell, cell]],
    merges: [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }],
    pinnedHeaderRows: 1,
    columnWidths: [100, 100],
    noBorder: false,
  };
  assert.equal(t.rows[0]!.length, 2);
});

test("Callout/Blockquote/NamedRange carry children: Block[]", () => {
  const para: ParagraphNode = { kind: "paragraph", runs: [{ text: "x" }] };
  const c: CalloutNode = { kind: "callout", preset: "INFO", children: [para] };
  const bq: BlockquoteNode = { kind: "blockquote", children: [para] };
  const nr: NamedRangeNode = { kind: "namedRange", name: "R1", children: [para] };
  assert.equal(c.children.length, 1);
  assert.equal(bq.children.length, 1);
  assert.equal(nr.children.length, 1);
});

test("SectionBreak / PageBreak / Hr shapes", () => {
  const sb: SectionBreakNode = { kind: "sectionBreak", sectionType: "NEXT_PAGE", columns: 2, orientation: "LANDSCAPE" };
  const pb: PageBreakNode = { kind: "pageBreak" };
  const hr: HrNode = { kind: "hr" };
  assert.equal(sb.kind, "sectionBreak");
  assert.equal(pb.kind, "pageBreak");
  assert.equal(hr.kind, "hr");
});

test("ReplaceText / ReplaceImage / Image shapes", () => {
  const rt: ReplaceTextNode = { kind: "replaceText", search: "{{x}}", replace: "y", matchCase: true };
  const ri: ReplaceImageNode = { kind: "replaceImage", objectId: "oid", uri: "https://x" };
  const im: ImageNode = { kind: "image", uri: "https://x", width: 10, height: 20 };
  assert.equal(rt.replace, "y");
  assert.equal(ri.objectId, "oid");
  assert.equal(im.uri, "https://x");
});

test("Block tagged union narrows on kind", () => {
  const b: Block = { kind: "hr" };
  if (b.kind === "hr") {
    assert.equal(b.kind, "hr");
  } else {
    assert.fail("expected hr");
  }
});

test("PullQuoteNode with all fields", () => {
  const pq: PullQuoteNode = {
    kind: "pullquote",
    text: "The only way to do great work is to love what you do.",
    attribution: "— Steve Jobs",
    style: "classic",
  };
  assert.equal(pq.kind, "pullquote");
  assert.equal(pq.text, "The only way to do great work is to love what you do.");
  assert.equal(pq.attribution, "— Steve Jobs");
  assert.equal(pq.style, "classic");
});

test("PullQuoteNode minimal (text only)", () => {
  const pq: PullQuoteNode = { kind: "pullquote", text: "Simple quote." };
  assert.equal(pq.kind, "pullquote");
  assert.equal(pq.text, "Simple quote.");
  assert.equal(pq.attribution, undefined);
  assert.equal(pq.style, undefined);
});

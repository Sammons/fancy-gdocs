import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeSpec, needsNormalization } from "./normalize.ts";
import type { ParagraphNode, TableNode, ListNode, CalloutNode, BlockquoteNode } from "./dag/types/block.ts";

describe("normalizeSpec", () => {
  test("transforms type:title to kind:paragraph with TITLE style", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "title", text: "Hello World" }],
    });
    const block = spec.blocks?.[0] as ParagraphNode;
    assert.equal(block.kind, "paragraph");
    assert.equal(block.style, "TITLE");
    assert.equal(block.runs[0].text, "Hello World");
  });

  test("transforms type:subtitle to kind:paragraph with SUBTITLE style", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "subtitle", text: "A subtitle" }],
    });
    const block = spec.blocks?.[0] as ParagraphNode;
    assert.equal(block.kind, "paragraph");
    assert.equal(block.style, "SUBTITLE");
  });

  test("transforms type:heading with level to kind:paragraph with HEADING_N style", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [
        { type: "heading", level: 1, text: "H1" },
        { type: "heading", level: 2, text: "H2" },
        { type: "heading", level: 3, text: "H3" },
      ],
    });
    const h1 = spec.blocks?.[0] as ParagraphNode;
    const h2 = spec.blocks?.[1] as ParagraphNode;
    const h3 = spec.blocks?.[2] as ParagraphNode;
    assert.equal(h1.style, "HEADING_1");
    assert.equal(h2.style, "HEADING_2");
    assert.equal(h3.style, "HEADING_3");
  });

  test("transforms anchor to anchorId on headings", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "heading", level: 1, text: "References", anchor: "refs" }],
    });
    const block = spec.blocks?.[0] as ParagraphNode;
    assert.equal(block.anchorId, "refs");
  });

  test("transforms type:paragraph", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "paragraph", text: "Plain text." }],
    });
    const block = spec.blocks?.[0] as ParagraphNode;
    assert.equal(block.kind, "paragraph");
    assert.equal(block.runs[0].text, "Plain text.");
  });

  test("transforms type:callout with style to preset", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "callout", style: "INFO", text: "Important!" }],
    });
    const block = spec.blocks?.[0] as CalloutNode;
    assert.equal(block.kind, "callout");
    assert.equal(block.preset, "INFO");
    const para = block.children[0] as ParagraphNode;
    assert.equal(para.runs[0].text, "Important!");
  });

  test("transforms type:blockquote", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "blockquote", text: "A quote" }],
    });
    const block = spec.blocks?.[0] as BlockquoteNode;
    assert.equal(block.kind, "blockquote");
    const para = block.children[0] as ParagraphNode;
    assert.equal(para.runs[0].text, "A quote");
  });

  test("transforms table cells with text/fill to CellNode format", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{
        type: "table",
        rows: [
          [{ text: "Header 1", bold: true, fill: "#1A73E8", color: "#FFFFFF" }],
          [{ text: "Cell A", fill: "#F8F9FA" }],
        ],
      }],
    });
    const table = spec.blocks?.[0] as TableNode;
    assert.equal(table.kind, "table");
    assert.equal(table.rows[0][0].kind, "cell");
    assert.equal(table.rows[0][0].backgroundColor, "#1A73E8");
    const para = table.rows[0][0].children[0] as ParagraphNode;
    assert.equal(para.runs[0].text, "Header 1");
    assert.equal(para.runs[0].bold, true);
  });

  test("transforms list items with level", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{
        type: "list",
        style: "BULLET",
        items: [
          { text: "First point" },
          { text: "Nested", level: 1 },
        ],
      }],
    });
    const list = spec.blocks?.[0] as ListNode;
    assert.equal(list.kind, "list");
    assert.equal(list.style, "BULLET");
    assert.equal(list.items.length, 2);
    const para1 = list.items[0][0] as ParagraphNode;
    assert.equal(para1.runs[0].text, "First point");
  });

  test("transforms type:image", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "image", uri: "https://example.com/img.png", width: 400, height: 300 }],
    });
    const block = spec.blocks?.[0];
    assert.equal(block?.kind, "image");
    assert.equal((block as any).uri, "https://example.com/img.png");
    assert.equal((block as any).width, 400);
  });

  test("transforms type:pageBreak", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "pageBreak" }],
    });
    assert.equal(spec.blocks?.[0].kind, "pageBreak");
  });

  test("transforms type:hr", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "hr" }],
    });
    assert.equal(spec.blocks?.[0].kind, "hr");
  });

  test("transforms type:sectionBreak", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{ type: "sectionBreak", sectionType: "CONTINUOUS", columns: 2 }],
    });
    const block = spec.blocks?.[0];
    assert.equal(block?.kind, "sectionBreak");
    assert.equal((block as any).sectionType, "CONTINUOUS");
    assert.equal((block as any).columns, 2);
  });

  test("normalizes runs with link to #anchor", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{
        type: "paragraph",
        runs: [
          { text: "See ", link: "#refs" },
        ],
      }],
    });
    const para = spec.blocks?.[0] as ParagraphNode;
    const run = para.runs[0];
    assert.deepEqual(run.link, { anchorId: "refs" });
  });

  test("normalizes footnote string to { runs: [{ text }] }", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{
        type: "paragraph",
        runs: [
          { text: "Text", footnote: "A footnote" },
        ],
      }],
    });
    const para = spec.blocks?.[0] as ParagraphNode;
    const run = para.runs[0];
    assert.deepEqual(run.footnote, { runs: [{ text: "A footnote" }] });
  });

  test("normalizes date string to { isoDate }", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{
        type: "paragraph",
        runs: [{ text: "", date: "2026-04-12" }],
      }],
    });
    const para = spec.blocks?.[0] as ParagraphNode;
    assert.deepEqual(para.runs[0].date, { isoDate: "2026-04-12" });
  });

  test("normalizes mention string to { email }", () => {
    const spec = normalizeSpec({
      title: "Test",
      blocks: [{
        type: "paragraph",
        runs: [{ mention: "jane@example.com" }],
      }],
    });
    const para = spec.blocks?.[0] as ParagraphNode;
    assert.deepEqual(para.runs[0].mention, { email: "jane@example.com" });
  });

  test("handles documentStyle alias", () => {
    const spec = normalizeSpec({
      title: "Test",
      documentStyle: { marginTop: 72 },
      blocks: [],
    });
    assert.equal((spec.docStyle as any)?.marginTop, 72);
  });

  test("normalizes header/footer with text", () => {
    const spec = normalizeSpec({
      title: "Test",
      header: { text: "Header Text" },
      blocks: [],
    });
    const headerBlock = spec.header?.blocks[0] as ParagraphNode;
    assert.equal(headerBlock.runs[0].text, "Header Text");
  });

  test("normalizes tabs with type-based blocks", () => {
    const spec = normalizeSpec({
      title: "Test",
      tabs: [{
        title: "Tab 1",
        blocks: [{ type: "heading", level: 1, text: "Title" }],
      }],
    });
    const para = spec.tabs?.[0].blocks[0] as ParagraphNode;
    assert.equal(para.style, "HEADING_1");
  });
});

describe("needsNormalization", () => {
  test("returns true for type-based blocks", () => {
    assert.equal(needsNormalization({
      title: "Test",
      blocks: [{ type: "paragraph", text: "Hi" }],
    }), true);
  });

  test("returns false for kind-based blocks", () => {
    assert.equal(needsNormalization({
      title: "Test",
      blocks: [{ kind: "paragraph", runs: [{ text: "Hi" }] }],
    }), false);
  });

  test("returns true for type-based blocks in tabs", () => {
    assert.equal(needsNormalization({
      title: "Test",
      tabs: [{ title: "T1", blocks: [{ type: "hr" }] }],
    }), true);
  });

  test("returns false for null/undefined", () => {
    assert.equal(needsNormalization(null), false);
    assert.equal(needsNormalization(undefined), false);
  });
});

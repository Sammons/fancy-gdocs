import { describe, it } from "node:test";
import assert from "node:assert";
import {
  extractColor,
  toRun,
  toParagraphBlock,
  toImageBlock,
  toTableBlock,
  isEmptyParagraph,
  isEmptyParagraphBlock,
  extractBlocksFromBody,
  processTab,
  flattenBlocks,
} from "./doc-reader.ts";
import type { GoogleDocsColor, GoogleDocsParagraphElement, GoogleDocsParagraph, GoogleDocsInlineObject } from "./google-docs-types.ts";

describe("extractColor", () => {
  it("returns undefined for undefined input", () => {
    assert.strictEqual(extractColor(undefined), undefined);
  });

  it("returns undefined for empty color object", () => {
    assert.strictEqual(extractColor({}), undefined);
  });

  it("returns undefined for color without rgbColor", () => {
    assert.strictEqual(extractColor({ color: {} }), undefined);
  });

  it("converts RGB to hex (black)", () => {
    const color: GoogleDocsColor = { color: { rgbColor: { red: 0, green: 0, blue: 0 } } };
    assert.strictEqual(extractColor(color), "#000000");
  });

  it("converts RGB to hex (white)", () => {
    const color: GoogleDocsColor = { color: { rgbColor: { red: 1, green: 1, blue: 1 } } };
    assert.strictEqual(extractColor(color), "#ffffff");
  });

  it("converts RGB to hex (red)", () => {
    const color: GoogleDocsColor = { color: { rgbColor: { red: 1, green: 0, blue: 0 } } };
    assert.strictEqual(extractColor(color), "#ff0000");
  });

  it("handles missing color components (defaults to 0)", () => {
    const color: GoogleDocsColor = { color: { rgbColor: { red: 0.5 } } };
    assert.strictEqual(extractColor(color), "#800000");
  });
});

describe("toRun", () => {
  it("returns null for non-textRun element", () => {
    const elem: GoogleDocsParagraphElement = { inlineObjectElement: { inlineObjectId: "img1" } };
    assert.strictEqual(toRun(elem), null);
  });

  it("extracts plain text", () => {
    const elem: GoogleDocsParagraphElement = { textRun: { content: "Hello" } };
    const run = toRun(elem);
    assert.deepStrictEqual(run, { text: "Hello" });
  });

  it("extracts bold formatting", () => {
    const elem: GoogleDocsParagraphElement = { textRun: { content: "Bold", textStyle: { bold: true } } };
    const run = toRun(elem);
    assert.strictEqual(run?.bold, true);
  });

  it("extracts italic formatting", () => {
    const elem: GoogleDocsParagraphElement = { textRun: { content: "Italic", textStyle: { italic: true } } };
    const run = toRun(elem);
    assert.strictEqual(run?.italic, true);
  });

  it("extracts link URL", () => {
    const elem: GoogleDocsParagraphElement = {
      textRun: { content: "Link", textStyle: { link: { url: "https://example.com" } } },
    };
    const run = toRun(elem);
    assert.strictEqual(run?.link, "https://example.com");
  });

  it("extracts font size", () => {
    const elem: GoogleDocsParagraphElement = {
      textRun: { content: "Big", textStyle: { fontSize: { magnitude: 24 } } },
    };
    const run = toRun(elem);
    assert.strictEqual(run?.fontSize, 24);
  });

  it("extracts font family", () => {
    const elem: GoogleDocsParagraphElement = {
      textRun: { content: "Custom", textStyle: { weightedFontFamily: { fontFamily: "Arial" } } },
    };
    const run = toRun(elem);
    assert.strictEqual(run?.fontFamily, "Arial");
  });

  it("extracts foreground color", () => {
    const elem: GoogleDocsParagraphElement = {
      textRun: {
        content: "Red",
        textStyle: { foregroundColor: { color: { rgbColor: { red: 1, green: 0, blue: 0 } } } },
      },
    };
    const run = toRun(elem);
    assert.strictEqual(run?.color, "#ff0000");
  });

  it("extracts superscript", () => {
    const elem: GoogleDocsParagraphElement = {
      textRun: { content: "2", textStyle: { baselineOffset: "SUPERSCRIPT" } },
    };
    const run = toRun(elem);
    assert.strictEqual(run?.superscript, true);
  });

  it("extracts subscript", () => {
    const elem: GoogleDocsParagraphElement = {
      textRun: { content: "2", textStyle: { baselineOffset: "SUBSCRIPT" } },
    };
    const run = toRun(elem);
    assert.strictEqual(run?.subscript, true);
  });
});

describe("toParagraphBlock", () => {
  it("returns null for paragraph with no elements", () => {
    const para: GoogleDocsParagraph = { elements: [] };
    assert.strictEqual(toParagraphBlock(para), null);
  });

  it("strips trailing newline from last run", () => {
    const para: GoogleDocsParagraph = {
      elements: [{ textRun: { content: "Hello\n" } }],
    };
    const block = toParagraphBlock(para);
    assert.strictEqual(block?.kind, "paragraph");
    if (block?.kind === "paragraph") {
      assert.strictEqual(block.runs[0].text, "Hello");
    }
  });

  it("preserves empty paragraph as single empty run", () => {
    const para: GoogleDocsParagraph = {
      elements: [{ textRun: { content: "\n" } }],
    };
    const block = toParagraphBlock(para);
    assert.strictEqual(block?.kind, "paragraph");
    if (block?.kind === "paragraph") {
      assert.strictEqual(block.runs.length, 1);
      assert.strictEqual(block.runs[0].text, "");
    }
  });

  it("extracts heading style", () => {
    const para: GoogleDocsParagraph = {
      elements: [{ textRun: { content: "Title\n" } }],
      paragraphStyle: { namedStyleType: "HEADING_1" },
    };
    const block = toParagraphBlock(para) as unknown as Record<string, unknown>;
    assert.strictEqual(block?.style, "HEADING_1");
  });

  it("omits NORMAL_TEXT style", () => {
    const para: GoogleDocsParagraph = {
      elements: [{ textRun: { content: "Normal\n" } }],
      paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
    };
    const block = toParagraphBlock(para) as unknown as Record<string, unknown>;
    assert.strictEqual(block?.style, undefined);
  });

  it("extracts alignment", () => {
    const para: GoogleDocsParagraph = {
      elements: [{ textRun: { content: "Centered\n" } }],
      paragraphStyle: { alignment: "CENTER" },
    };
    const block = toParagraphBlock(para) as unknown as Record<string, unknown>;
    assert.strictEqual(block?.alignment, "CENTER");
  });
});

describe("toImageBlock", () => {
  it("returns null for missing object", () => {
    const block = toImageBlock("missing", {});
    assert.strictEqual(block, null);
  });

  it("returns null for object without embedded image", () => {
    const inlineObjects: Record<string, GoogleDocsInlineObject> = {
      img1: { inlineObjectProperties: {} },
    };
    const block = toImageBlock("img1", inlineObjects);
    assert.strictEqual(block, null);
  });

  it("extracts image with contentUri", () => {
    const inlineObjects: Record<string, GoogleDocsInlineObject> = {
      img1: {
        inlineObjectProperties: {
          embeddedObject: {
            imageProperties: { contentUri: "https://example.com/image.png" },
            size: { width: { magnitude: 100 }, height: { magnitude: 50 } },
          },
        },
      },
    };
    const block = toImageBlock("img1", inlineObjects);
    assert.strictEqual(block?.kind, "image");
    if (block?.kind === "image") {
      assert.strictEqual(block.uri, "https://example.com/image.png");
      assert.strictEqual((block as unknown as Record<string, unknown>).width, 100);
      assert.strictEqual((block as unknown as Record<string, unknown>).height, 50);
    }
  });
});

describe("toTableBlock", () => {
  it("converts empty table", () => {
    const block = toTableBlock({ tableRows: [] });
    assert.strictEqual(block.kind, "table");
    if (block.kind === "table") {
      assert.deepStrictEqual(block.rows, []);
    }
  });

  it("converts table with cells containing paragraphs", () => {
    const block = toTableBlock({
      tableRows: [
        {
          tableCells: [
            {
              content: [{ paragraph: { elements: [{ textRun: { content: "A1\n" } }] } }],
            },
          ],
        },
      ],
    });
    assert.strictEqual(block.kind, "table");
    if (block.kind === "table") {
      assert.strictEqual(block.rows.length, 1);
      assert.strictEqual(block.rows[0].length, 1);
      const cell = block.rows[0][0] as unknown as Record<string, unknown>;
      assert.strictEqual(cell.kind, "cell");
    }
  });

  it("extracts cell background color", () => {
    const block = toTableBlock({
      tableRows: [
        {
          tableCells: [
            {
              content: [],
              tableCellStyle: {
                backgroundColor: { color: { rgbColor: { red: 1, green: 0, blue: 0 } } },
              },
            },
          ],
        },
      ],
    });
    if (block.kind === "table") {
      const cell = block.rows[0][0] as unknown as Record<string, unknown>;
      assert.strictEqual(cell.backgroundColor, "#ff0000");
    }
  });

  it("extracts vertical alignment", () => {
    const block = toTableBlock({
      tableRows: [
        {
          tableCells: [
            {
              content: [],
              tableCellStyle: { contentAlignment: "MIDDLE" },
            },
          ],
        },
      ],
    });
    if (block.kind === "table") {
      const cell = block.rows[0][0] as unknown as Record<string, unknown>;
      assert.strictEqual(cell.verticalAlign, "MIDDLE");
    }
  });
});

describe("isEmptyParagraph", () => {
  it("returns true for paragraph with no elements", () => {
    assert.strictEqual(isEmptyParagraph({ elements: [] }), true);
  });

  it("returns true for paragraph with just newline", () => {
    assert.strictEqual(isEmptyParagraph({ elements: [{ textRun: { content: "\n" } }] }), true);
  });

  it("returns true for paragraph with empty string", () => {
    assert.strictEqual(isEmptyParagraph({ elements: [{ textRun: { content: "" } }] }), true);
  });

  it("returns false for paragraph with content", () => {
    assert.strictEqual(isEmptyParagraph({ elements: [{ textRun: { content: "Hello\n" } }] }), false);
  });
});

describe("isEmptyParagraphBlock", () => {
  it("returns false for non-paragraph block", () => {
    assert.strictEqual(isEmptyParagraphBlock({ kind: "image" }), false);
  });

  it("returns true for paragraph with no runs", () => {
    assert.strictEqual(isEmptyParagraphBlock({ kind: "paragraph", runs: [] }), true);
  });

  it("returns true for paragraph with empty text runs", () => {
    assert.strictEqual(isEmptyParagraphBlock({ kind: "paragraph", runs: [{ text: "" }] }), true);
  });

  it("returns false for paragraph with content", () => {
    assert.strictEqual(isEmptyParagraphBlock({ kind: "paragraph", runs: [{ text: "Hello" }] }), false);
  });
});

describe("extractBlocksFromBody", () => {
  it("returns empty array for undefined body", () => {
    assert.deepStrictEqual(extractBlocksFromBody(undefined, {}), []);
  });

  it("skips first empty paragraph", () => {
    const body = {
      content: [
        { paragraph: { elements: [{ textRun: { content: "\n" } }] } },
        { paragraph: { elements: [{ textRun: { content: "Hello\n" } }] } },
      ],
    };
    const blocks = extractBlocksFromBody(body, {});
    assert.strictEqual(blocks.length, 1);
  });

  it("extracts tables", () => {
    const body = {
      content: [
        { table: { tableRows: [] } },
      ],
    };
    const blocks = extractBlocksFromBody(body, {});
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].kind, "table");
  });

  it("strips trailing empty paragraphs", () => {
    const body = {
      content: [
        { paragraph: { elements: [{ textRun: { content: "Hello\n" } }] } },
        { paragraph: { elements: [{ textRun: { content: "\n" } }] } },
      ],
    };
    const blocks = extractBlocksFromBody(body, {});
    assert.strictEqual(blocks.length, 1);
  });

  it("strips empty paragraphs before tables", () => {
    const body = {
      content: [
        { paragraph: { elements: [{ textRun: { content: "\n" } }] } },
        { paragraph: { elements: [{ textRun: { content: "\n" } }] } },
        { table: { tableRows: [] } },
      ],
    };
    const blocks = extractBlocksFromBody(body, {});
    // First empty para skipped (implicit), second empty para stripped before table
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].kind, "table");
  });
});

describe("processTab", () => {
  it("extracts tab title", () => {
    const tab = {
      tabProperties: { title: "My Tab" },
      documentTab: { body: { content: [] } },
    };
    const spec = processTab(tab, {});
    assert.strictEqual(spec.title, "My Tab");
  });

  it("defaults to Untitled for missing title", () => {
    const tab = { documentTab: { body: { content: [] } } };
    const spec = processTab(tab, {});
    assert.strictEqual(spec.title, "Untitled");
  });

  it("processes child tabs", () => {
    const tab = {
      tabProperties: { title: "Parent" },
      documentTab: { body: { content: [] } },
      childTabs: [
        { tabProperties: { title: "Child" }, documentTab: { body: { content: [] } } },
      ],
    };
    const spec = processTab(tab, {});
    assert.strictEqual(spec.children?.length, 1);
    assert.strictEqual(spec.children?.[0].title, "Child");
  });
});

describe("flattenBlocks", () => {
  it("returns empty array for empty input", () => {
    assert.deepStrictEqual(flattenBlocks([]), []);
  });

  it("flattens single tab", () => {
    const tabs = [{ title: "Tab 1", blocks: [{ kind: "paragraph" as const, runs: [{ text: "A" }] }] }];
    const blocks = flattenBlocks(tabs);
    assert.strictEqual(blocks.length, 1);
  });

  it("flattens nested tabs", () => {
    const tabs = [
      {
        title: "Parent",
        blocks: [{ kind: "paragraph" as const, runs: [{ text: "P" }] }],
        children: [
          { title: "Child", blocks: [{ kind: "paragraph" as const, runs: [{ text: "C" }] }] },
        ],
      },
    ];
    const blocks = flattenBlocks(tabs);
    assert.strictEqual(blocks.length, 2);
  });
});

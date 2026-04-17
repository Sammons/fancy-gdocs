/**
 * Google Docs API → DSL extraction helpers.
 * Converts raw Google Docs API responses into gdocs DSL format.
 */

import type { Block } from "../dag/types/block.ts";
import type { Run } from "../dag/types/run.ts";
import type { NamedStyle } from "../dag/types/style-tokens.ts";
import type {
  GoogleDocsColor,
  GoogleDocsParagraph,
  GoogleDocsParagraphElement,
  GoogleDocsStructuralElement,
  GoogleDocsBody,
  GoogleDocsTable,
  GoogleDocsTableCell,
  GoogleDocsTab,
  GoogleDocsInlineObject,
} from "./google-docs-types.ts";

// ---------------------------------------------------------------------------
// Color extraction
// ---------------------------------------------------------------------------

/**
 * Extract hex color string from Google Docs color object.
 * Returns undefined if color is not present or malformed.
 */
export function extractColor(color: GoogleDocsColor | undefined): string | undefined {
  if (!color?.color?.rgbColor) return undefined;
  const { red = 0, green = 0, blue = 0 } = color.color.rgbColor;
  const r = Math.round(red * 255);
  const g = Math.round(green * 255);
  const b = Math.round(blue * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Paragraph element → Run
// ---------------------------------------------------------------------------

/**
 * Convert a Google Docs paragraph element to a DSL Run.
 * Returns null if the element is not a text run.
 */
export function toRun(elem: GoogleDocsParagraphElement): Run | null {
  if (elem.textRun) {
    const tr = elem.textRun;
    const style = tr.textStyle || {};
    const run: Run = { text: tr.content || "" };
    if (style.bold) run.bold = true;
    if (style.italic) run.italic = true;
    if (style.underline) run.underline = true;
    if (style.strikethrough) run.strikethrough = true;
    if (style.link?.url) run.link = style.link.url;
    if (style.fontSize?.magnitude) run.fontSize = style.fontSize.magnitude;
    if (style.weightedFontFamily?.fontFamily) run.fontFamily = style.weightedFontFamily.fontFamily;
    const fg = extractColor(style.foregroundColor);
    if (fg) run.color = fg;
    const bg = extractColor(style.backgroundColor);
    if (bg) run.backgroundColor = bg;
    if (style.baselineOffset === "SUPERSCRIPT") run.superscript = true;
    if (style.baselineOffset === "SUBSCRIPT") run.subscript = true;
    return run;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Paragraph → Block
// ---------------------------------------------------------------------------

/**
 * Convert a Google Docs paragraph to a DSL Block.
 * Returns null if the paragraph has no content.
 */
export function toParagraphBlock(para: GoogleDocsParagraph): Block | null {
  const runs: Run[] = [];
  for (const elem of para.elements || []) {
    const run = toRun(elem);
    if (run) runs.push(run);
  }
  if (runs.length === 0) return null;

  // Strip trailing newline from paragraph content.
  // Google Docs paragraphs end with \n, but emitParagraph adds it back.
  const lastRun = runs[runs.length - 1];
  if (lastRun.text.endsWith("\n")) {
    lastRun.text = lastRun.text.slice(0, -1);
  }

  // Remove any empty runs (can happen after stripping newlines)
  const nonEmptyRuns = runs.filter(r => r.text !== "");

  // Empty paragraphs (just "\n" in source) are meaningful — they provide vertical spacing.
  const finalRuns = nonEmptyRuns.length > 0 ? nonEmptyRuns : [{ text: "" }];

  const style = para.paragraphStyle?.namedStyleType as NamedStyle | undefined;
  const alignment = para.paragraphStyle?.alignment;
  const block: Block = { kind: "paragraph", runs: finalRuns };
  if (style && style !== "NORMAL_TEXT") (block as unknown as Record<string, unknown>).style = style;
  if (alignment && alignment !== "START") (block as unknown as Record<string, unknown>).alignment = alignment;
  return block;
}

// ---------------------------------------------------------------------------
// Image → Block
// ---------------------------------------------------------------------------

/**
 * Convert an inline object (image) to a DSL Block.
 * Returns null if the object is not a valid image.
 */
export function toImageBlock(
  objectId: string,
  inlineObjects: Record<string, GoogleDocsInlineObject>,
): Block | null {
  const obj = inlineObjects[objectId];
  const embedded = obj?.inlineObjectProperties?.embeddedObject;
  if (!embedded) return null;
  const uri = embedded.imageProperties?.contentUri || embedded.imageProperties?.sourceUri;
  if (!uri) return null;
  const block: Block = { kind: "image", uri };
  if (embedded.size?.width?.magnitude) (block as unknown as Record<string, unknown>).width = embedded.size.width.magnitude;
  if (embedded.size?.height?.magnitude) (block as unknown as Record<string, unknown>).height = embedded.size.height.magnitude;
  return block;
}

// ---------------------------------------------------------------------------
// Table → Block
// ---------------------------------------------------------------------------

/**
 * Convert a Google Docs table to a DSL Block.
 */
export function toTableBlock(table: GoogleDocsTable): Block {
  const rows: Record<string, unknown>[][] = [];
  for (const row of table.tableRows || []) {
    const cells: Record<string, unknown>[] = [];
    for (const cell of row.tableCells || []) {
      const children: Block[] = [];
      for (const elem of cell.content || []) {
        if (elem.paragraph) {
          const pb = toParagraphBlock(elem.paragraph);
          if (pb) children.push(pb);
        }
      }
      const cellNode: Record<string, unknown> = { kind: "cell", children };

      // Extract cell background color from tableCellStyle
      const cellStyle = cell.tableCellStyle;
      if (cellStyle?.backgroundColor?.color?.rgbColor) {
        const bg = extractColor(cellStyle.backgroundColor);
        if (bg) cellNode.backgroundColor = bg;
      }

      // Extract vertical alignment
      if (cellStyle?.contentAlignment && cellStyle.contentAlignment !== "TOP") {
        cellNode.verticalAlign = cellStyle.contentAlignment;
      }

      cells.push(cellNode);
    }
    rows.push(cells);
  }
  return { kind: "table", rows } as unknown as Block;
}

// ---------------------------------------------------------------------------
// Helper predicates
// ---------------------------------------------------------------------------

/**
 * Check if a paragraph is empty (just "\n" or empty elements).
 */
export function isEmptyParagraph(para: GoogleDocsParagraph): boolean {
  const elements = para.elements || [];
  if (elements.length === 0) return true;
  if (elements.length === 1) {
    const elem = elements[0];
    if (elem.textRun) {
      const content = elem.textRun.content || "";
      return content === "\n" || content === "";
    }
  }
  return false;
}

/**
 * Check if a block is an empty paragraph.
 */
export function isEmptyParagraphBlock(b: Record<string, unknown>): boolean {
  if (b.kind !== "paragraph") return false;
  const runs = b.runs as { text: string }[] | undefined;
  if (!runs || runs.length === 0) return true;
  return runs.every((r) => r.text === "" || r.text === undefined);
}

// ---------------------------------------------------------------------------
// Body → Blocks
// ---------------------------------------------------------------------------

/**
 * Extract blocks from a Google Docs body.
 * Handles paragraphs, tables, images, and section breaks.
 */
export function extractBlocksFromBody(
  body: GoogleDocsBody | undefined,
  inlineObjects: Record<string, GoogleDocsInlineObject>,
): Block[] {
  const blocks: Block[] = [];
  const content = body?.content || [];
  let seenFirstParagraph = false;

  for (let i = 0; i < content.length; i++) {
    const element = content[i];
    if (element.paragraph) {
      // Skip the implicit first empty paragraph (Google Docs always starts with one)
      if (!seenFirstParagraph && isEmptyParagraph(element.paragraph)) {
        seenFirstParagraph = true;
        continue;
      }
      seenFirstParagraph = true;

      // Check for inline images in paragraph
      for (const elem of element.paragraph.elements || []) {
        if (elem.inlineObjectElement?.inlineObjectId) {
          const imgBlock = toImageBlock(elem.inlineObjectElement.inlineObjectId, inlineObjects);
          if (imgBlock) blocks.push(imgBlock);
        }
      }
      const pb = toParagraphBlock(element.paragraph);
      if (pb) blocks.push(pb);
    } else if (element.table) {
      blocks.push(toTableBlock(element.table));
    } else if (element.sectionBreak) {
      // Skip the implicit first section break (exists at index 0 in every doc)
      const isFirstElement = i === 0;
      const isImplicitSection = element.endIndex === 1 &&
        element.sectionBreak.sectionStyle?.sectionType === "CONTINUOUS";
      if (isFirstElement && isImplicitSection) {
        continue;
      }
      blocks.push({ kind: "sectionBreak" } as Block);
    }
  }

  // Strip trailing empty paragraphs (Google Docs adds these)
  while (blocks.length > 0) {
    const last = blocks[blocks.length - 1] as unknown as Record<string, unknown>;
    if (last.kind !== "paragraph") break;
    const runs = last.runs as { text: string }[];
    if (!runs || runs.length === 0) {
      blocks.pop();
      continue;
    }
    const allEmpty = runs.every((r) => r.text === "" || r.text === undefined);
    if (allEmpty) {
      blocks.pop();
    } else {
      break;
    }
  }

  // Strip empty paragraphs that appear immediately before tables
  const cleaned: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const curr = blocks[i] as unknown as Record<string, unknown>;
    const next = blocks[i + 1] as unknown as Record<string, unknown> | undefined;
    if (isEmptyParagraphBlock(curr) && next?.kind === "table") {
      continue;
    }
    cleaned.push(blocks[i]);
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Tab processing
// ---------------------------------------------------------------------------

export interface TabSpec {
  title: string;
  blocks: Block[];
  children?: TabSpec[];
}

/**
 * Recursively process a tab and its children into TabSpec.
 */
export function processTab(
  tab: GoogleDocsTab,
  inlineObjects: Record<string, GoogleDocsInlineObject>,
): TabSpec {
  const tabTitle = tab.tabProperties?.title || "Untitled";
  const body = tab.documentTab?.body;
  const blocks = extractBlocksFromBody(body, inlineObjects);
  const spec: TabSpec = { title: tabTitle, blocks };

  if (tab.childTabs && tab.childTabs.length > 0) {
    spec.children = tab.childTabs.map(t => processTab(t, inlineObjects));
  }

  return spec;
}

/**
 * Flatten all blocks from a tab tree (for markdown mode).
 */
export function flattenBlocks(tabs: TabSpec[]): Block[] {
  let result: Block[] = [];
  for (const tab of tabs) {
    result = result.concat(tab.blocks);
    if (tab.children) {
      result = result.concat(flattenBlocks(tab.children));
    }
  }
  return result;
}

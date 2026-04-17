/**
 * Normalization layer for gdocs skill.
 *
 * Transforms the SKILL.md type-based DSL format to the DAG kind-based format.
 * This allows agents to use the documented interface while the internal compiler
 * works with the normalized kind-based Block types.
 */

import type { DocSpec, TabSpec, HeaderFooterSpec } from "./dag/types/doc-spec.ts";
import type { Block, CellNode, TableNode, ListNode, ParagraphNode, CalloutNode, BlockquoteNode } from "./dag/types/block.ts";
import type { Run } from "./dag/types/run.ts";
import type { NamedStyle, ListStyle } from "./dag/types/style-tokens.ts";

// ---------------------------------------------------------------------------
// Input types (SKILL.md DSL format)
// ---------------------------------------------------------------------------

interface TypedRun {
  text?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  highlight?: string;    // alias for backgroundColor
  fill?: string;         // alias for backgroundColor in runs
  link?: string;
  fontSize?: number;
  fontFamily?: string;
  superscript?: boolean;
  subscript?: boolean;
  footnote?: string | TypedRun[];
  date?: string;         // ISO date string
  mention?: string;      // email address
  smallCaps?: boolean;
  fontWeight?: number;
}

interface TypedCell {
  text?: string;
  runs?: TypedRun[];
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fill?: string;         // cell background
  backgroundColor?: string; // alias for fill
  borderTop?: { color?: string; width?: number; dashStyle?: string };
  borderBottom?: { color?: string; width?: number; dashStyle?: string };
  borderLeft?: { color?: string; width?: number; dashStyle?: string };
  borderRight?: { color?: string; width?: number; dashStyle?: string };
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  verticalAlignment?: "TOP" | "MIDDLE" | "BOTTOM";
}

interface TypedListItem {
  text?: string;
  runs?: TypedRun[];
  level?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

interface TypedBlock {
  type?: string;
  kind?: string;
  // Common
  text?: string;
  runs?: TypedRun[];
  alignment?: string;
  // Heading-specific
  level?: number;
  anchor?: string;       // maps to anchorId
  // Paragraph-specific
  spacing?: { before?: number; after?: number } | number;
  lineSpacing?: number;
  indent?: { left?: number; right?: number; firstLine?: number };
  keepWithNext?: boolean;
  keepTogether?: boolean;
  pageBreakBefore?: boolean;
  fill?: string;
  borders?: Record<string, { color?: string; width?: number; dashStyle?: string; padding?: number }>;
  // Callout-specific
  style?: string;        // maps to preset for callouts
  preset?: string;
  borderColor?: string;
  // Table-specific
  rows?: TypedCell[][];
  pinnedHeaderRows?: number;
  columnWidths?: number[];
  merge?: { row: number; col: number; rowSpan: number; colSpan: number }[];
  rowMinHeight?: number;
  preventOverflow?: boolean;
  noBorder?: boolean;
  // List-specific
  items?: TypedListItem[];
  // Image-specific
  uri?: string;
  width?: number;
  height?: number;
  // Section break
  sectionType?: "NEXT_PAGE" | "CONTINUOUS";
  columns?: number;
  columnSeparator?: boolean;
  orientation?: "PORTRAIT" | "LANDSCAPE";
  // Pullquote
  attribution?: string;
  // replaceText / replaceImage
  search?: string;
  replace?: string;
  matchCase?: boolean;
  objectId?: string;
  // namedRange
  name?: string;
  children?: TypedBlock[];
}

interface TypedHeaderFooter {
  text?: string;
  runs?: TypedRun[];
  blocks?: TypedBlock[];
}

interface TypedTab {
  title: string;
  icon?: string;
  blocks: TypedBlock[];
}

interface TypedSpec {
  title: string;
  account?: string;
  tabs?: TypedTab[];
  blocks?: TypedBlock[];
  theme?: Record<string, unknown>;
  documentStyle?: Record<string, unknown>;
  docStyle?: Record<string, unknown>;
  header?: TypedHeaderFooter;
  footer?: TypedHeaderFooter;
  firstPageHeader?: TypedHeaderFooter;
  firstPageFooter?: TypedHeaderFooter;
}

// ---------------------------------------------------------------------------
// Normalization functions
// ---------------------------------------------------------------------------

/**
 * Normalize a typed run to the internal Run format.
 */
function normalizeRun(r: TypedRun): Run {
  const run: Run = { text: r.text ?? "" };

  if (r.bold) run.bold = true;
  if (r.italic) run.italic = true;
  if (r.underline) run.underline = true;
  if (r.strikethrough) run.strikethrough = true;
  if (r.superscript) run.superscript = true;
  if (r.subscript) run.subscript = true;
  if (r.fontSize) run.fontSize = r.fontSize;
  if (r.fontFamily) run.fontFamily = r.fontFamily;
  if (r.color) run.color = r.color;

  // Handle background color aliases
  const bg = r.backgroundColor ?? r.highlight ?? r.fill;
  if (bg) run.backgroundColor = bg;

  // Handle link (string or anchor ref)
  if (r.link) {
    if (r.link.startsWith("#")) {
      run.link = { anchorId: r.link.slice(1) };
    } else {
      run.link = r.link;
    }
  }

  // Handle footnote (string or Run[])
  if (r.footnote !== undefined) {
    if (typeof r.footnote === "string") {
      run.footnote = { runs: [{ text: r.footnote }] };
    } else if (Array.isArray(r.footnote)) {
      run.footnote = { runs: r.footnote.map(normalizeRun) };
    }
  }

  // Handle date (ISO string -> { isoDate })
  if (r.date) {
    run.date = { isoDate: r.date };
  }

  // Handle mention (email -> { email })
  if (r.mention) {
    run.mention = { email: r.mention };
  }

  return run;
}

/**
 * Normalize runs array or text to Run[].
 */
function normalizeRuns(block: { text?: string; runs?: TypedRun[]; bold?: boolean; italic?: boolean; color?: string }): Run[] {
  if (block.runs) {
    return block.runs.map(normalizeRun);
  }
  if (block.text !== undefined) {
    const run: Run = { text: block.text };
    if (block.bold) run.bold = true;
    if (block.italic) run.italic = true;
    if (block.color) run.color = block.color;
    return [run];
  }
  return [];
}

/**
 * Normalize a table cell to CellNode format.
 */
function normalizeCell(cell: TypedCell): CellNode {
  const children: Block[] = [];

  // Create a paragraph block from the cell content
  const runs = normalizeRuns(cell);
  if (runs.length > 0) {
    children.push({ kind: "paragraph", runs });
  }

  const cellNode: CellNode = {
    kind: "cell",
    children,
  };

  // Handle background color (fill or backgroundColor)
  const bg = cell.fill ?? cell.backgroundColor;
  if (bg) cellNode.backgroundColor = bg;

  // Handle vertical alignment
  if (cell.verticalAlignment) {
    cellNode.verticalAlign = cell.verticalAlignment;
  }

  // Handle padding (use first non-undefined)
  const padding = cell.padding ?? cell.paddingTop ?? cell.paddingBottom ?? cell.paddingLeft ?? cell.paddingRight;
  if (padding !== undefined) cellNode.padding = padding;

  // Handle borders (simplified - use color only)
  const borders: Record<string, string> = {};
  if (cell.borderTop?.color) borders.top = cell.borderTop.color;
  if (cell.borderRight?.color) borders.right = cell.borderRight.color;
  if (cell.borderBottom?.color) borders.bottom = cell.borderBottom.color;
  if (cell.borderLeft?.color) borders.left = cell.borderLeft.color;
  if (Object.keys(borders).length > 0) cellNode.borders = borders;

  return cellNode;
}

/**
 * Normalize list items to Block[][] format.
 * Each item becomes a paragraph block, grouped by level.
 */
function normalizeListItems(items: TypedListItem[]): Block[][] {
  return items.map(item => {
    const runs = normalizeRuns(item);
    const para: ParagraphNode = { kind: "paragraph", runs };
    // Note: level is handled at the list emit level, not in the block itself
    return [para];
  });
}

/**
 * Map type-based block type to named style for headings.
 */
function headingLevelToStyle(level: number): NamedStyle {
  const styles: Record<number, NamedStyle> = {
    1: "HEADING_1",
    2: "HEADING_2",
    3: "HEADING_3",
    4: "HEADING_4",
    5: "HEADING_5",
    6: "HEADING_6",
  };
  return styles[level] ?? "HEADING_1";
}

/**
 * Normalize a single typed block to kind-based Block.
 */
function normalizeBlock(block: TypedBlock): Block {
  // If already in kind-based format, return as-is (with minimal normalization)
  if (block.kind && !block.type) {
    return block as Block;
  }

  const blockType = block.type ?? block.kind;

  switch (blockType) {
    case "title": {
      const para: ParagraphNode = {
        kind: "paragraph",
        style: "TITLE",
        runs: normalizeRuns(block),
      };
      if (block.alignment) para.alignment = block.alignment as ParagraphNode["alignment"];
      return para;
    }

    case "subtitle": {
      const para: ParagraphNode = {
        kind: "paragraph",
        style: "SUBTITLE",
        runs: normalizeRuns(block),
      };
      if (block.alignment) para.alignment = block.alignment as ParagraphNode["alignment"];
      return para;
    }

    case "heading": {
      const para: ParagraphNode = {
        kind: "paragraph",
        style: headingLevelToStyle(block.level ?? 1),
        runs: normalizeRuns(block),
      };
      if (block.alignment) para.alignment = block.alignment as ParagraphNode["alignment"];
      if (block.anchor) para.anchorId = block.anchor;
      return para;
    }

    case "paragraph": {
      const para: ParagraphNode = {
        kind: "paragraph",
        runs: normalizeRuns(block),
      };
      if (block.alignment) para.alignment = block.alignment as ParagraphNode["alignment"];
      if (block.lineSpacing) para.lineSpacing = block.lineSpacing;
      if (block.anchor) para.anchorId = block.anchor;
      if (typeof block.spacing === "number") {
        para.spacing = block.spacing;
      }
      if (block.indent) {
        para.indent = {
          firstLine: block.indent.firstLine,
          start: block.indent.left,
        };
      }
      return para;
    }

    case "callout": {
      const callout: CalloutNode = {
        kind: "callout",
        children: [{ kind: "paragraph", runs: normalizeRuns(block) }],
      };
      // Map style -> preset
      const preset = block.preset ?? block.style;
      if (preset) callout.preset = preset as CalloutNode["preset"];
      if (block.fill) callout.fill = block.fill;
      if (block.borderColor) callout.borderColor = block.borderColor;
      return callout;
    }

    case "blockquote": {
      const bq: BlockquoteNode = {
        kind: "blockquote",
        children: [{ kind: "paragraph", runs: normalizeRuns(block) }],
      };
      return bq;
    }

    case "table": {
      const rows = (block.rows ?? []).map(row => row.map(normalizeCell));
      const table: TableNode = {
        kind: "table",
        rows,
      };
      if (block.merge) table.merges = block.merge;
      if (block.pinnedHeaderRows) table.pinnedHeaderRows = block.pinnedHeaderRows;
      if (block.columnWidths) table.columnWidths = block.columnWidths;
      if (block.noBorder) table.noBorder = block.noBorder;
      return table;
    }

    case "list": {
      const items = block.items ?? [];
      // Normalize list style
      let style: ListStyle = "BULLET";
      if (block.style === "NUMBER" || block.style === "NUMBERED") {
        style = "NUMBERED";
      } else if (block.style === "CHECK") {
        style = "CHECK";
      }
      const list: ListNode = {
        kind: "list",
        style,
        items: normalizeListItems(items),
      };
      return list;
    }

    case "image": {
      return {
        kind: "image",
        uri: block.uri ?? "",
        width: block.width,
        height: block.height,
      };
    }

    case "pageBreak": {
      return { kind: "pageBreak" };
    }

    case "hr": {
      return { kind: "hr" };
    }

    case "sectionBreak": {
      return {
        kind: "sectionBreak",
        sectionType: block.sectionType,
        columns: block.columns,
        orientation: block.orientation,
      };
    }

    case "pullquote": {
      return {
        kind: "pullquote",
        text: block.text ?? "",
        attribution: block.attribution,
        style: block.style as "classic" | "modern" | "minimal" | undefined,
      };
    }

    case "replaceText": {
      return {
        kind: "replaceText",
        search: block.search ?? "",
        replace: block.replace ?? "",
        matchCase: block.matchCase,
      };
    }

    case "replaceImage": {
      return {
        kind: "replaceImage",
        objectId: block.objectId ?? "",
        uri: block.uri ?? "",
      };
    }

    case "namedRange": {
      return {
        kind: "namedRange",
        name: block.name ?? "",
        children: (block.children ?? []).map(normalizeBlock),
      };
    }

    default:
      // Unknown type - pass through as-is (may fail at compile time)
      return block as Block;
  }
}

/**
 * Normalize header/footer spec.
 */
function normalizeHeaderFooter(hf: TypedHeaderFooter): HeaderFooterSpec {
  // If blocks are provided, normalize them
  if (hf.blocks) {
    return { blocks: hf.blocks.map(normalizeBlock) };
  }
  // Otherwise create a single paragraph from text/runs
  const runs = normalizeRuns(hf);
  return { blocks: [{ kind: "paragraph", runs }] };
}

/**
 * Normalize a full spec from type-based DSL to kind-based DocSpec.
 */
export function normalizeSpec(spec: TypedSpec): DocSpec {
  const result: DocSpec = {
    title: spec.title,
    account: spec.account ?? "work",
  };

  // Normalize blocks or tabs
  if (spec.tabs) {
    result.tabs = spec.tabs.map(tab => ({
      title: tab.title,
      icon: tab.icon,
      blocks: tab.blocks.map(normalizeBlock),
    }));
  } else if (spec.blocks) {
    result.blocks = spec.blocks.map(normalizeBlock);
  }

  // Pass through theme
  if (spec.theme) {
    result.theme = spec.theme as DocSpec["theme"];
  }

  // Normalize docStyle (handle documentStyle alias)
  const docStyle = spec.docStyle ?? spec.documentStyle;
  if (docStyle) {
    result.docStyle = docStyle as DocSpec["docStyle"];
  }

  // Normalize header/footer
  if (spec.header) result.header = normalizeHeaderFooter(spec.header);
  if (spec.footer) result.footer = normalizeHeaderFooter(spec.footer);
  if (spec.firstPageHeader) result.firstPageHeader = normalizeHeaderFooter(spec.firstPageHeader);
  if (spec.firstPageFooter) result.firstPageFooter = normalizeHeaderFooter(spec.firstPageFooter);

  return result;
}

/**
 * Check if a spec uses type-based format (needs normalization).
 */
export function needsNormalization(spec: unknown): boolean {
  if (!spec || typeof spec !== "object") return false;
  const s = spec as TypedSpec;

  // Check top-level blocks
  if (s.blocks?.some(b => b.type !== undefined)) return true;

  // Check tabs
  if (s.tabs?.some(t => t.blocks?.some(b => b.type !== undefined))) return true;

  // Check header/footer
  if ((s.header as TypedHeaderFooter)?.blocks?.some(b => b.type !== undefined)) return true;
  if ((s.footer as TypedHeaderFooter)?.blocks?.some(b => b.type !== undefined)) return true;

  return false;
}

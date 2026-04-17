import type { Run } from "./run.ts";
import type { NamedStyle, Alignment, ListStyle } from "./style-tokens.ts";

export interface ParagraphNode {
  kind: "paragraph";
  style?: NamedStyle;
  runs: Run[];
  alignment?: Alignment;
  spacing?: number;
  lineSpacing?: number;
  indent?: { firstLine?: number; start?: number };
  anchorId?: string;
}

export interface ImageNode {
  kind: "image";
  uri: string;
  width?: number;
  height?: number;
}

export interface ListNode {
  kind: "list";
  style: ListStyle;
  items: Block[][];
}

export interface CellBorders {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

export interface CellNode {
  kind: "cell";
  children: Block[];
  backgroundColor?: string;
  borders?: CellBorders;
  verticalAlign?: "TOP" | "MIDDLE" | "BOTTOM";
  padding?: number;
}

export interface TableMerge {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface TableNode {
  kind: "table";
  rows: CellNode[][];
  merges?: TableMerge[];
  pinnedHeaderRows?: number;
  columnWidths?: number[];
  noBorder?: boolean;
}

export interface PageBreakNode {
  kind: "pageBreak";
}

export interface HrNode {
  kind: "hr";
}

export interface SectionBreakNode {
  kind: "sectionBreak";
  sectionType?: "NEXT_PAGE" | "CONTINUOUS";
  columns?: number;
  orientation?: "PORTRAIT" | "LANDSCAPE";
}

export interface CalloutNode {
  kind: "callout";
  preset?: "INFO" | "WARNING" | "SUCCESS" | "NOTE";
  fill?: string;
  borderColor?: string;
  children: Block[];
}

export interface BlockquoteNode {
  kind: "blockquote";
  children: Block[];
}

export interface ReplaceTextNode {
  kind: "replaceText";
  search: string;
  replace: string;
  matchCase?: boolean;
}

export interface ReplaceImageNode {
  kind: "replaceImage";
  objectId: string;
  uri: string;
}

export interface NamedRangeNode {
  kind: "namedRange";
  name: string;
  children: Block[];
}

export interface PullQuoteNode {
  kind: "pullquote";
  text: string;
  attribution?: string;
  style?: "classic" | "modern" | "minimal";
}

export type Block =
  | ParagraphNode
  | ImageNode
  | ListNode
  | TableNode
  | PageBreakNode
  | HrNode
  | SectionBreakNode
  | CalloutNode
  | BlockquoteNode
  | ReplaceTextNode
  | ReplaceImageNode
  | NamedRangeNode
  | PullQuoteNode;

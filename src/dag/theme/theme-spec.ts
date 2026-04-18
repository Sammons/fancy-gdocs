// ThemeSpec — defines styling defaults that apply as fallbacks across the document.
// Per-named-style overrides allow different fonts/colors for headings vs body text.

export interface NamedStyleOverride {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  // Paragraph-level spacing (applied via updateParagraphStyle)
  spaceAbove?: number;   // space before paragraph in pt
  spaceBelow?: number;   // space after paragraph in pt
  lineSpacing?: number;  // line spacing multiplier (1.0 = single, 1.5 = 1.5x, etc.)
}

export interface TableTheme {
  // Header row styling
  headerBackground?: string;    // background color for header row
  headerColor?: string;         // text color for header row
  headerBold?: boolean;         // bold text in header row (default: true)

  // Cell styling
  cellPadding?: number;         // padding in pt (all sides)
  cellVerticalAlign?: "TOP" | "MIDDLE" | "BOTTOM";

  // Border styling
  borderColor?: string;         // border color
  borderWidth?: number;         // border width in pt

  // Alternating row colors
  alternateRowBackground?: string;  // background for odd rows (even rows = white)
}

export interface ThemeSpec {
  // Global defaults — applied to all text where not already set
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  headingColor?: string;  // fallback for HEADING_* if no per-style override
  linkColor?: string;

  // Table styling defaults
  table?: TableTheme;

  // Per-named-style overrides — keyed by namedStyleType
  // These take precedence over global defaults for matching paragraphs
  TITLE?: NamedStyleOverride;
  SUBTITLE?: NamedStyleOverride;
  HEADING_1?: NamedStyleOverride;
  HEADING_2?: NamedStyleOverride;
  HEADING_3?: NamedStyleOverride;
  HEADING_4?: NamedStyleOverride;
  HEADING_5?: NamedStyleOverride;
  HEADING_6?: NamedStyleOverride;
  NORMAL_TEXT?: NamedStyleOverride;
}

// Named style types that can have overrides
export type NamedStyleType =
  | "TITLE"
  | "SUBTITLE"
  | "HEADING_1"
  | "HEADING_2"
  | "HEADING_3"
  | "HEADING_4"
  | "HEADING_5"
  | "HEADING_6"
  | "NORMAL_TEXT";

export const NAMED_STYLE_TYPES: NamedStyleType[] = [
  "TITLE",
  "SUBTITLE",
  "HEADING_1",
  "HEADING_2",
  "HEADING_3",
  "HEADING_4",
  "HEADING_5",
  "HEADING_6",
  "NORMAL_TEXT",
];

export const HEADING_STYLES: NamedStyleType[] = [
  "TITLE",
  "SUBTITLE",
  "HEADING_1",
  "HEADING_2",
  "HEADING_3",
  "HEADING_4",
  "HEADING_5",
  "HEADING_6",
];

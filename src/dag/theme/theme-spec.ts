// ThemeSpec — defines styling defaults that apply as fallbacks across the document.
// Per-named-style overrides allow different fonts/colors for headings vs body text.

export interface NamedStyleOverride {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  // spacing is handled at paragraph level, not text style
}

export interface ThemeSpec {
  // Global defaults — applied to all text where not already set
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  headingColor?: string;  // fallback for HEADING_* if no per-style override
  linkColor?: string;

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

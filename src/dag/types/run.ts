export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  link?: string | { anchorId: string };
  fontSize?: number;
  fontFamily?: string;
  superscript?: boolean;
  subscript?: boolean;
  footnote?: { runs: Run[] };
  date?: { isoDate: string };
  mention?: { email: string };
}

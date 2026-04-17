import type { Block } from "./block.ts";
import type { ThemeSpec } from "../theme/theme-spec.ts";

export interface DocStyleSpec {
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  pageWidth?: number;
  pageHeight?: number;
  size?: "LETTER" | "A4" | "LEGAL";
  orientation?: "PORTRAIT" | "LANDSCAPE";
  background?: string;
}

export interface HeaderFooterSpec {
  blocks: Block[];
}

export interface TabSpec {
  title: string;
  icon?: string;
  blocks: Block[];
  children?: TabSpec[];
}

export interface DocSpec {
  title: string;
  account: string;
  tabs?: TabSpec[];
  blocks?: Block[];
  theme?: ThemeSpec;
  docStyle?: DocStyleSpec;
  header?: HeaderFooterSpec;
  footer?: HeaderFooterSpec;
  firstPageHeader?: HeaderFooterSpec;
  firstPageFooter?: HeaderFooterSpec;
}

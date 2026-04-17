/**
 * TypeScript interfaces for Google Docs API response shapes.
 * Used to reduce `any` usage in entrypoint.ts.
 */

/** Response from documents.batchUpdate when adding tabs. */
export interface BatchUpdateReply {
  addDocumentTab?: {
    tabProperties?: {
      tabId?: string;
      title?: string;
    };
  };
  createFootnote?: {
    footnoteId?: string;
  };
  createHeader?: {
    headerId?: string;
  };
  createFooter?: {
    footerId?: string;
  };
  createNamedRange?: {
    namedRangeId?: string;
  };
}

export interface BatchUpdateResponse {
  replies?: BatchUpdateReply[];
  documentId?: string;
  writeControl?: {
    requiredRevisionId?: string;
  };
}

/** Subset of Google Docs document structure used in DSL extraction. */
export interface GoogleDocsTab {
  tabProperties?: {
    tabId?: string;
    title?: string;
    index?: number;
  };
  documentTab?: {
    body?: GoogleDocsBody;
    headers?: Record<string, GoogleDocsHeaderFooter>;
    footers?: Record<string, GoogleDocsHeaderFooter>;
    footnotes?: Record<string, GoogleDocsFootnote>;
    inlineObjects?: Record<string, GoogleDocsInlineObject>;
  };
  childTabs?: GoogleDocsTab[];
}

export interface GoogleDocsBody {
  content?: GoogleDocsStructuralElement[];
}

export interface GoogleDocsStructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: GoogleDocsParagraph;
  table?: GoogleDocsTable;
  sectionBreak?: {
    sectionStyle?: {
      sectionType?: string;
      columnProperties?: unknown[];
    };
  };
}

export interface GoogleDocsParagraph {
  elements?: GoogleDocsParagraphElement[];
  paragraphStyle?: {
    namedStyleType?: string;
    alignment?: string;
    headingId?: string;
  };
}

export interface GoogleDocsParagraphElement {
  startIndex?: number;
  endIndex?: number;
  textRun?: {
    content?: string;
    textStyle?: GoogleDocsTextStyle;
  };
  inlineObjectElement?: {
    inlineObjectId?: string;
  };
}

export interface GoogleDocsTextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: { magnitude?: number; unit?: string };
  weightedFontFamily?: { fontFamily?: string; weight?: number };
  foregroundColor?: GoogleDocsColor;
  backgroundColor?: GoogleDocsColor;
  baselineOffset?: string;
  link?: { url?: string; headingId?: string; bookmarkId?: string };
}

export interface GoogleDocsColor {
  color?: {
    rgbColor?: { red?: number; green?: number; blue?: number };
  };
}

export interface GoogleDocsTable {
  rows?: number;
  columns?: number;
  tableRows?: GoogleDocsTableRow[];
  tableStyle?: {
    tableColumnProperties?: { widthType?: string; width?: { magnitude?: number } }[];
  };
}

export interface GoogleDocsTableRow {
  tableCells?: GoogleDocsTableCell[];
}

export interface GoogleDocsTableCell {
  content?: GoogleDocsStructuralElement[];
  tableCellStyle?: {
    backgroundColor?: GoogleDocsColor;
    contentAlignment?: string;
  };
}

export interface GoogleDocsHeaderFooter {
  headerId?: string;
  footerId?: string;
  content?: GoogleDocsStructuralElement[];
}

export interface GoogleDocsFootnote {
  footnoteId?: string;
  content?: GoogleDocsStructuralElement[];
}

export interface GoogleDocsInlineObject {
  inlineObjectProperties?: {
    embeddedObject?: {
      imageProperties?: {
        contentUri?: string;
        sourceUri?: string;
      };
      size?: {
        width?: { magnitude?: number };
        height?: { magnitude?: number };
      };
    };
  };
}

export interface GoogleDocsDocument {
  documentId?: string;
  title?: string;
  tabs?: GoogleDocsTab[];
  documentStyle?: {
    defaultHeaderId?: string;
    defaultFooterId?: string;
    firstPageHeaderId?: string;
    firstPageFooterId?: string;
    evenPageHeaderId?: string;
    evenPageFooterId?: string;
  };
}

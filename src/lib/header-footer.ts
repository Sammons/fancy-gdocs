/**
 * Header/footer compilation for Google Docs.
 * Extracted from build-requests.ts for standalone usage.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlight?: string;
  fill?: string;
  link?: string;
  smallCaps?: boolean;
  fontWeight?: number;
}

export interface HeaderFooterSpec {
  text?: string;
  runs?: Run[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue: parseInt(h.slice(4, 6), 16) / 255,
  };
}

export function buildTextStyle(run: Run): { style: Record<string, unknown>; fields: string } | null {
  const style: Record<string, unknown> = {};
  const fields: string[] = [];

  if (run.bold != null) {
    style.bold = run.bold;
    fields.push("bold");
  }
  if (run.italic != null) {
    style.italic = run.italic;
    fields.push("italic");
  }
  if (run.underline != null) {
    style.underline = run.underline;
    fields.push("underline");
  }
  if (run.strikethrough != null) {
    style.strikethrough = run.strikethrough;
    fields.push("strikethrough");
  }
  if (run.superscript) {
    style.baselineOffset = "SUPERSCRIPT";
    fields.push("baselineOffset");
  } else if (run.subscript) {
    style.baselineOffset = "SUBSCRIPT";
    fields.push("baselineOffset");
  }
  if (run.fontSize != null) {
    style.fontSize = { magnitude: run.fontSize, unit: "PT" };
    fields.push("fontSize");
  }
  if (run.fontFamily) {
    style.weightedFontFamily = { fontFamily: run.fontFamily };
    fields.push("weightedFontFamily");
  }
  if (run.color) {
    style.foregroundColor = { color: { rgbColor: hexToRgb(run.color) } };
    fields.push("foregroundColor");
  }
  const highlight = run.highlight ?? run.fill;
  if (highlight) {
    style.backgroundColor = { color: { rgbColor: hexToRgb(highlight) } };
    fields.push("backgroundColor");
  }
  if (run.link) {
    style.link = { url: run.link };
    fields.push("link");
  }
  if (run.smallCaps) {
    style.smallCaps = true;
    fields.push("smallCaps");
  }
  if (run.fontWeight != null) {
    style.weightedFontFamily = {
      fontFamily: run.fontFamily ?? "Roboto",
      weight: run.fontWeight,
    };
    fields.push("weightedFontFamily");
  }

  return fields.length > 0 ? { style, fields: fields.join(",") } : null;
}

function compileSegmentRuns(runs: Run[]): { text: string; styles: Array<{ run: Run; start: number; end: number }> } {
  let text = "";
  const styles: Array<{ run: Run; start: number; end: number }> = [];
  for (const run of runs) {
    const start = text.length;
    text += run.text;
    styles.push({ run, start, end: text.length });
  }
  return { text, styles };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Compile header/footer runs into batchUpdate requests.
 * Returns insertText + updateTextStyle requests for the segment.
 */
export function compileHeaderFooterRequests(
  spec: HeaderFooterSpec,
  segmentId: string,
): Record<string, unknown>[] {
  const runs = spec.runs ?? [{ text: spec.text ?? "" }];
  const compiled = compileSegmentRuns(runs);
  if (!compiled.text) return [];

  const reqs: Record<string, unknown>[] = [
    { insertText: { text: compiled.text, location: { segmentId, index: 0 } } },
  ];

  for (const { run, start, end } of compiled.styles) {
    const result = buildTextStyle(run);
    if (result) {
      reqs.push({
        updateTextStyle: {
          range: { segmentId, startIndex: start, endIndex: end },
          textStyle: result.style,
          fields: result.fields,
        },
      });
    }
  }

  return reqs;
}

// applyTheme — post-pass that fills in default textStyle values from a ThemeSpec.
// Never overrides explicit fields. Idempotent.
//
// Per-named-style overrides (TITLE, HEADING_1, etc.) take precedence over global
// defaults. Each deferred updateTextStyle request carries a namedStyleType tag
// set by the paragraph emitter.

import type { DocIR, Segment, SegmentRelativeRequest } from "../ir/doc-ir.ts";
import type { ThemeSpec, NamedStyleOverride, NamedStyleType, HEADING_STYLES } from "./theme-spec.ts";

export function applyTheme(docIR: DocIR, theme: ThemeSpec): DocIR {
  return {
    segments: docIR.segments.map((s) => rewriteSegment(s, theme)),
  };
}

function rewriteSegment(s: Segment, theme: ThemeSpec): Segment {
  return {
    segmentId: s.segmentId,
    tabId: s.tabId,
    localRequests: s.localRequests.map((r) => rewrite(r, theme)),
    deferredRequests: s.deferredRequests.map((r) => rewrite(r, theme)),
  };
}

function isHeadingStyle(style: NamedStyleType | undefined): boolean {
  if (!style) return false;
  return style === "TITLE" || style === "SUBTITLE" || style.startsWith("HEADING_");
}

function getStyleOverride(theme: ThemeSpec, namedStyleType: NamedStyleType | undefined): NamedStyleOverride | undefined {
  if (!namedStyleType) return undefined;
  // TypeScript doesn't allow indexing with arbitrary strings, so we use a switch
  switch (namedStyleType) {
    case "TITLE": return theme.TITLE;
    case "SUBTITLE": return theme.SUBTITLE;
    case "HEADING_1": return theme.HEADING_1;
    case "HEADING_2": return theme.HEADING_2;
    case "HEADING_3": return theme.HEADING_3;
    case "HEADING_4": return theme.HEADING_4;
    case "HEADING_5": return theme.HEADING_5;
    case "HEADING_6": return theme.HEADING_6;
    case "NORMAL_TEXT": return theme.NORMAL_TEXT;
    default: return undefined;
  }
}

function rewrite(r: SegmentRelativeRequest, theme: ThemeSpec): SegmentRelativeRequest {
  const req = JSON.parse(JSON.stringify(r.request)) as Record<string, unknown>;
  const uts = req.updateTextStyle as { textStyle?: Record<string, unknown>; fields?: string } | undefined;
  if (uts) {
    const ts = uts.textStyle ?? (uts.textStyle = {});
    const existingFields = new Set((uts.fields ?? "").split(",").filter(Boolean));
    const addField = (name: string) => existingFields.add(name);

    // Get per-named-style override if available
    const styleOverride = getStyleOverride(theme, r.namedStyleType);

    // Determine effective values: per-style override > global default
    const effectiveFont = styleOverride?.fontFamily ?? theme.fontFamily;
    const effectiveFontSize = styleOverride?.fontSize ?? theme.fontSize;
    const effectiveBold = styleOverride?.bold;
    const effectiveItalic = styleOverride?.italic;

    // Color priority: per-style > headingColor (for headings) > textColor
    let effectiveColor: string | undefined;
    if (styleOverride?.color) {
      effectiveColor = styleOverride.color;
    } else if (isHeadingStyle(r.namedStyleType) && theme.headingColor) {
      effectiveColor = theme.headingColor;
    } else {
      effectiveColor = theme.textColor;
    }

    // Apply font family
    if (effectiveFont && !ts.weightedFontFamily) {
      ts.weightedFontFamily = { fontFamily: effectiveFont };
      addField("weightedFontFamily");
    }

    // Apply font size
    if (effectiveFontSize && !ts.fontSize) {
      ts.fontSize = { magnitude: effectiveFontSize, unit: "PT" };
      addField("fontSize");
    }

    // Apply color
    if (effectiveColor && !ts.foregroundColor) {
      ts.foregroundColor = { color: { rgbColor: hexToRgb(effectiveColor) } };
      addField("foregroundColor");
    }

    // Apply bold (only from per-style override)
    if (effectiveBold !== undefined && ts.bold === undefined) {
      ts.bold = effectiveBold;
      addField("bold");
    }

    // Apply italic (only from per-style override)
    if (effectiveItalic !== undefined && ts.italic === undefined) {
      ts.italic = effectiveItalic;
      addField("italic");
    }

    uts.fields = Array.from(existingFields).join(",");
  }
  return { request: req, indexFields: r.indexFields.slice(), namedStyleType: r.namedStyleType };
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((x) => x + x).join("") : m, 16);
  return { red: ((n >> 16) & 0xff) / 255, green: ((n >> 8) & 0xff) / 255, blue: (n & 0xff) / 255 };
}

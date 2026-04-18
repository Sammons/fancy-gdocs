// emitRuns: insert text runs and apply per-run updateTextStyle.
// Pure helper used by paragraph, callout, blockquote, cell, list.
// Returns the end index (segment-relative) after all runs are inserted.
// Does NOT emit a trailing newline — caller is responsible for paragraph terminators.

import type { Run } from "../types/run.ts";
import type { EmitContext } from "../ir/emit-context.ts";

export function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return {
    red: ((n >> 16) & 0xff) / 255,
    green: ((n >> 8) & 0xff) / 255,
    blue: (n & 0xff) / 255,
  };
}

interface TextStyleBuild {
  style: Record<string, unknown>;
  fields: string[];
}

/**
 * Check if a link is an anchor reference that needs phase-2 resolution.
 * This includes:
 * - String links starting with "#" (e.g., "#section1")
 * - Object links with user-defined anchorId (e.g., { anchorId: "section1" })
 *
 * Google-assigned heading IDs start with "h." (e.g., "h.abc123def456")
 * and don't need phase-2 resolution.
 */
function isAnchorLink(link: Run["link"]): boolean {
  if (typeof link === "string") {
    return link.startsWith("#");
  }
  if (typeof link === "object" && link !== null && "anchorId" in link) {
    // User-defined anchor names need phase-2 resolution.
    // Google-assigned heading IDs start with "h." and can be used directly.
    return !link.anchorId.startsWith("h.");
  }
  return false;
}

/**
 * Extract anchor name from a link (either "#anchorName" string or { anchorId: "..." } object).
 */
function getAnchorName(link: Run["link"]): string {
  if (typeof link === "string") {
    return link.slice(1); // Remove leading "#"
  }
  if (typeof link === "object" && link !== null && "anchorId" in link) {
    return link.anchorId;
  }
  throw new Error(`getAnchorName: unexpected link format: ${JSON.stringify(link)}`);
}

export function buildTextStyle(run: Run, skipAnchorLink = false): TextStyleBuild {
  const style: Record<string, unknown> = {};
  const fields: string[] = [];
  if (run.bold !== undefined) { style.bold = run.bold; fields.push("bold"); }
  if (run.italic !== undefined) { style.italic = run.italic; fields.push("italic"); }
  if (run.underline !== undefined) { style.underline = run.underline; fields.push("underline"); }
  if (run.strikethrough !== undefined) { style.strikethrough = run.strikethrough; fields.push("strikethrough"); }
  if (run.color) {
    style.foregroundColor = { color: { rgbColor: hexToRgb(run.color) } };
    fields.push("foregroundColor");
  }
  if (run.backgroundColor) {
    style.backgroundColor = { color: { rgbColor: hexToRgb(run.backgroundColor) } };
    fields.push("backgroundColor");
  }
  if (run.link !== undefined && !(skipAnchorLink && isAnchorLink(run.link))) {
    if (typeof run.link === "string") {
      style.link = { url: run.link };
    } else {
      style.link = { headingId: run.link.anchorId };
    }
    fields.push("link");
  }
  if (run.fontSize !== undefined) {
    style.fontSize = { magnitude: run.fontSize, unit: "PT" };
    fields.push("fontSize");
  }
  if (run.fontFamily) {
    style.weightedFontFamily = { fontFamily: run.fontFamily };
    fields.push("weightedFontFamily");
  }
  if (run.superscript) { style.baselineOffset = "SUPERSCRIPT"; fields.push("baselineOffset"); }
  else if (run.subscript) { style.baselineOffset = "SUBSCRIPT"; fields.push("baselineOffset"); }
  // Always return a result (even if empty) so theme application can fill in defaults.
  // Empty style/fields will be populated by applyTheme with font, size, color.
  return { style, fields };
}

export function emitRuns(runs: Run[], startIndex: number, ctx: EmitContext): number {
  let idx = startIndex;
  for (const run of runs) {
    const text = run.text;
    // Process text if present
    if (text) {
      ctx.pushRequest(
        { insertText: { text, location: { index: idx } } },
        ["insertText.location.index"],
      );
      ctx.cursor.advance(text.length);
      const runStart = idx;
      const runEnd = idx + text.length;
      idx = runEnd;

      // Check if this run has an anchor link that needs phase-2 resolution.
      // This includes "#heading-name" strings and { anchorId: "..." } objects
      // with user-defined anchor names (not Google-assigned "h.xxx" IDs).
      const hasAnchorLink = isAnchorLink(run.link);
      if (hasAnchorLink) {
        // Register pending anchor link for phase-2 patching
        ctx.registry.registerPendingAnchorLink({
          range: { startIndex: runStart, endIndex: runEnd },
          anchorName: getAnchorName(run.link),
          tabId: ctx.scope.getTabId(),
        });
      }

      // Build text style, skipping anchor link (handled in phase 2)
      // IMPORTANT: Use pushDeferred so updateTextStyle runs AFTER updateParagraphStyle.
      // When namedStyleType is applied via updateParagraphStyle, it resets text formatting.
      // By deferring updateTextStyle, inline styles (color, bold, etc.) are applied last.
      // Always emit updateTextStyle so theme application can fill in font/color/size defaults.
      const ts = buildTextStyle(run, hasAnchorLink);
      ctx.pushDeferred(
        {
          updateTextStyle: {
            range: { startIndex: runStart, endIndex: runEnd },
            textStyle: ts.style,
            fields: ts.fields.join(","),
          },
        },
        ["updateTextStyle.range.startIndex", "updateTextStyle.range.endIndex"],
      );
    }

    // Register footnote if present (deferred - createFootnote happens later)
    // Footnote marker appears at current index (after text if any)
    if (run.footnote) {
      ctx.registry.registerFootnote(
        idx,
        run.footnote.runs,
        ctx.scope.getTabId(),
      );
      // Do NOT advance cursor here - footnote ref char (+1) is inserted
      // when createFootnote is executed in a later phase
    }
  }
  return idx;
}

// emitPullquote: magazine-style decorative quote block.
// Inserts opening quote mark + text (centered, italic, large font),
// then attribution line (right-aligned, smaller font).
// Optional left border accent for visual prominence.

import type { PullQuoteNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import { hexToRgb } from "./run.ts";

interface StyleConfig {
  quoteFont: number;
  attrFont: number;
  quoteChar: string;
  borderColor: string;
  borderWidth: number;
}

const STYLES: Record<string, StyleConfig> = {
  classic: {
    quoteFont: 18,
    attrFont: 11,
    quoteChar: "\u201C", // "
    borderColor: "#666666",
    borderWidth: 4,
  },
  modern: {
    quoteFont: 16,
    attrFont: 10,
    quoteChar: "\u2014 ", // — (em dash prefix)
    borderColor: "#2196F3",
    borderWidth: 3,
  },
  minimal: {
    quoteFont: 16,
    attrFont: 10,
    quoteChar: "",
    borderColor: "#CCCCCC",
    borderWidth: 2,
  },
};

export function emitPullquote(node: PullQuoteNode, ctx: EmitContext): void {
  const cfg = STYLES[node.style ?? "classic"];
  const quoteText = cfg.quoteChar + node.text;

  const start = ctx.cursor.getIndex();

  // Insert quote text
  ctx.pushRequest(
    { insertText: { text: quoteText, location: { index: start } } },
    ["insertText.location.index"],
  );
  ctx.cursor.advance(quoteText.length);
  const afterQuote = ctx.cursor.getIndex();

  // Trailing newline for quote paragraph
  ctx.pushRequest(
    { insertText: { text: "\n", location: { index: afterQuote } } },
    ["insertText.location.index"],
  );
  ctx.cursor.advance(1);
  const quoteEnd = ctx.cursor.getIndex();

  // Style quote text: italic + large font
  ctx.pushRequest(
    {
      updateTextStyle: {
        range: { startIndex: start, endIndex: afterQuote },
        textStyle: {
          italic: true,
          fontSize: { magnitude: cfg.quoteFont, unit: "PT" },
        },
        fields: "italic,fontSize",
      },
    },
    ["updateTextStyle.range.startIndex", "updateTextStyle.range.endIndex"],
  );

  // Paragraph style: centered + left border
  ctx.pushRequest(
    {
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: quoteEnd },
        paragraphStyle: {
          alignment: "CENTER",
          borderLeft: {
            color: { color: { rgbColor: hexToRgb(cfg.borderColor) } },
            width: { magnitude: cfg.borderWidth, unit: "PT" },
            padding: { magnitude: 12, unit: "PT" },
            dashStyle: "SOLID",
          },
          indentStart: { magnitude: 36, unit: "PT" },
          indentEnd: { magnitude: 36, unit: "PT" },
          spaceAbove: { magnitude: 12, unit: "PT" },
        },
        fields: "alignment,borderLeft,indentStart,indentEnd,spaceAbove",
      },
    },
    ["updateParagraphStyle.range.startIndex", "updateParagraphStyle.range.endIndex"],
  );

  // Attribution line (if present)
  if (node.attribution) {
    const attrStart = ctx.cursor.getIndex();

    ctx.pushRequest(
      { insertText: { text: node.attribution, location: { index: attrStart } } },
      ["insertText.location.index"],
    );
    ctx.cursor.advance(node.attribution.length);
    const afterAttr = ctx.cursor.getIndex();

    // Trailing newline
    ctx.pushRequest(
      { insertText: { text: "\n", location: { index: afterAttr } } },
      ["insertText.location.index"],
    );
    ctx.cursor.advance(1);
    const attrEnd = ctx.cursor.getIndex();

    // Style attribution: smaller font
    ctx.pushRequest(
      {
        updateTextStyle: {
          range: { startIndex: attrStart, endIndex: afterAttr },
          textStyle: {
            fontSize: { magnitude: cfg.attrFont, unit: "PT" },
          },
          fields: "fontSize",
        },
      },
      ["updateTextStyle.range.startIndex", "updateTextStyle.range.endIndex"],
    );

    // Attribution paragraph: right-aligned, matching indent, space below
    ctx.pushRequest(
      {
        updateParagraphStyle: {
          range: { startIndex: attrStart, endIndex: attrEnd },
          paragraphStyle: {
            alignment: "END",
            indentStart: { magnitude: 36, unit: "PT" },
            indentEnd: { magnitude: 36, unit: "PT" },
            spaceBelow: { magnitude: 12, unit: "PT" },
          },
          fields: "alignment,indentStart,indentEnd,spaceBelow",
        },
      },
      ["updateParagraphStyle.range.startIndex", "updateParagraphStyle.range.endIndex"],
    );
  }
}

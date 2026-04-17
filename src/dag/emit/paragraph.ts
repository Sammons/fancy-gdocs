// emitParagraph: runs + trailing newline + optional updateParagraphStyle.
// Registers anchorId and outline entry when applicable.
// Sets named style context for theme application to text runs.

import type { ParagraphNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import type { NamedStyleType } from "../theme/theme-spec.ts";
import { emitRuns } from "./run.ts";

const HEADING_LEVELS: Record<string, number> = {
  HEADING_1: 1, HEADING_2: 2, HEADING_3: 3, HEADING_4: 4, HEADING_5: 5, HEADING_6: 6,
};

export function emitParagraph(node: ParagraphNode, ctx: EmitContext): void {
  const start = ctx.cursor.getIndex();

  if (node.anchorId) {
    ctx.registry.registerAnchor(node.anchorId, {
      segmentId: ctx.scope.getSegmentId(),
      tabId: ctx.scope.getTabId(),
      index: start,
    });
  }

  // Set named style context so emitRuns tags its requests for theme application
  const prevNamedStyle = ctx.getNamedStyle();
  if (node.style) {
    ctx.setNamedStyle(node.style as NamedStyleType);
  }

  const afterRuns = emitRuns(node.runs, start, ctx);

  // Restore previous named style context
  ctx.setNamedStyle(prevNamedStyle);

  // trailing newline (paragraph terminator)
  ctx.pushRequest(
    { insertText: { text: "\n", location: { index: afterRuns } } },
    ["insertText.location.index"],
  );
  ctx.cursor.advance(1);
  const end = afterRuns + 1;

  const style: Record<string, unknown> = {};
  const fields: string[] = [];
  if (node.style) { style.namedStyleType = node.style; fields.push("namedStyleType"); }
  if (node.alignment) { style.alignment = node.alignment; fields.push("alignment"); }
  if (node.spacing != null) {
    style.spaceAbove = { magnitude: node.spacing, unit: "PT" };
    fields.push("spaceAbove");
  }
  if (node.lineSpacing != null) {
    style.lineSpacing = node.lineSpacing <= 10 ? node.lineSpacing * 100 : node.lineSpacing;
    fields.push("lineSpacing");
  }
  if (node.indent) {
    if (node.indent.start != null) {
      style.indentStart = { magnitude: node.indent.start, unit: "PT" };
      fields.push("indentStart");
    }
    if (node.indent.firstLine != null) {
      style.indentFirstLine = { magnitude: node.indent.firstLine, unit: "PT" };
      fields.push("indentFirstLine");
    }
  }

  if (fields.length > 0) {
    ctx.pushRequest(
      {
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: style,
          fields: fields.join(","),
        },
      },
      ["updateParagraphStyle.range.startIndex", "updateParagraphStyle.range.endIndex"],
    );
  }

  if (node.style && HEADING_LEVELS[node.style] && node.anchorId) {
    const text = node.runs.map((r) => r.text).join("");
    ctx.registry.addOutlineEntry({
      level: HEADING_LEVELS[node.style],
      text,
      anchorId: node.anchorId,
    });
  }
}

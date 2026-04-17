// emitCallout: emit children then wrap full range with updateParagraphStyle
// (left border + shading + indent). Preset colors ported from build-requests.ts.
// MVP: children limited to paragraph nodes (consistent with list MVP).

import type { CalloutNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import { emitParagraph } from "./paragraph.ts";
import { hexToRgb } from "./run.ts";

const PRESETS: Record<string, { fill: string; border: string }> = {
  INFO: { fill: "#E3F2FD", border: "#2196F3" },
  WARNING: { fill: "#FFF3E0", border: "#FF9800" },
  SUCCESS: { fill: "#E8F5E9", border: "#4CAF50" },
  NOTE: { fill: "#F3E5F5", border: "#9C27B0" },
};

export function emitCallout(node: CalloutNode, ctx: EmitContext): void {
  const preset = node.preset ? PRESETS[node.preset] : undefined;
  const fill = node.fill ?? preset?.fill ?? "#F5F5F5";
  const border = node.borderColor ?? preset?.border ?? "#CCCCCC";

  const start = ctx.cursor.getIndex();
  for (const child of node.children) {
    if (child.kind !== "paragraph") {
      throw new Error(`callout children must be paragraphs (got ${child.kind}) — MVP`);
    }
    emitParagraph(child, ctx);
  }
  const end = ctx.cursor.getIndex();

  ctx.pushRequest(
    {
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          shading: { backgroundColor: { color: { rgbColor: hexToRgb(fill) } } },
          borderLeft: {
            color: { color: { rgbColor: hexToRgb(border) } },
            width: { magnitude: 3, unit: "PT" },
            padding: { magnitude: 8, unit: "PT" },
            dashStyle: "SOLID",
          },
          indentStart: { magnitude: 12, unit: "PT" },
        },
        fields: "shading,borderLeft,indentStart",
      },
    },
    ["updateParagraphStyle.range.startIndex", "updateParagraphStyle.range.endIndex"],
  );
}

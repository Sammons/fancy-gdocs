// emitBlockquote: emit children (paragraphs only, MVP) then wrap with
// updateParagraphStyle (indent + subtle fill + left border).

import type { BlockquoteNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import { emitParagraph } from "./paragraph.ts";
import { hexToRgb } from "./run.ts";

export function emitBlockquote(node: BlockquoteNode, ctx: EmitContext): void {
  const start = ctx.cursor.getIndex();
  for (const child of node.children) {
    if (child.kind !== "paragraph") {
      throw new Error(`blockquote children must be paragraphs (got ${child.kind}) — MVP`);
    }
    emitParagraph(child, ctx);
  }
  const end = ctx.cursor.getIndex();

  ctx.pushRequest(
    {
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          shading: { backgroundColor: { color: { rgbColor: hexToRgb("#F9F9F9") } } },
          borderLeft: {
            color: { color: { rgbColor: hexToRgb("#CCCCCC") } },
            width: { magnitude: 3, unit: "PT" },
            padding: { magnitude: 6, unit: "PT" },
            dashStyle: "SOLID",
          },
          indentStart: { magnitude: 36, unit: "PT" },
        },
        fields: "shading,borderLeft,indentStart",
      },
    },
    ["updateParagraphStyle.range.startIndex", "updateParagraphStyle.range.endIndex"],
  );
}

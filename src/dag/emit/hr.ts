// emitHr: Docs has no HR API; we synthesize with an empty paragraph that has
// a bottom border. Ported from build-requests.ts insertHr pattern.

import type { HrNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";

export function emitHr(_node: HrNode, ctx: EmitContext): void {
  const start = ctx.cursor.getIndex();
  ctx.pushRequest(
    { insertText: { text: "\n", location: { index: start } } },
    ["insertText.location.index"],
  );
  ctx.cursor.advance(1);
  ctx.pushRequest(
    {
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: start + 1 },
        paragraphStyle: {
          borderBottom: {
            color: { color: { rgbColor: { red: 0.8, green: 0.8, blue: 0.8 } } },
            width: { magnitude: 1, unit: "PT" },
            padding: { magnitude: 6, unit: "PT" },
            dashStyle: "SOLID",
          },
          spaceBelow: { magnitude: 6, unit: "PT" },
        },
        fields: "borderBottom,spaceBelow",
      },
    },
    ["updateParagraphStyle.range.startIndex", "updateParagraphStyle.range.endIndex"],
  );
}

// emitSectionBreak: insertSectionBreak + optional updateSectionStyle.
// Section break occupies 2 index positions.

import type { SectionBreakNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";

export function emitSectionBreak(node: SectionBreakNode, ctx: EmitContext): void {
  const idx = ctx.cursor.getIndex();
  const sectionType = node.sectionType ?? "NEXT_PAGE";
  ctx.pushRequest(
    { insertSectionBreak: { sectionType, location: { index: idx } } },
    ["insertSectionBreak.location.index"],
  );
  ctx.cursor.advance(2);

  const ss: Record<string, unknown> = {};
  const fields: string[] = [];
  if (node.orientation === "LANDSCAPE") { ss.flipPageOrientation = true; fields.push("flipPageOrientation"); }
  else if (node.orientation === "PORTRAIT") { ss.flipPageOrientation = false; fields.push("flipPageOrientation"); }
  if (node.columns && node.columns > 1) {
    ss.columnProperties = Array.from({ length: node.columns }, () => ({
      paddingEnd: { magnitude: 36, unit: "PT" },
    }));
    fields.push("columnProperties");
  }
  if (fields.length > 0) {
    const after = ctx.cursor.getIndex();
    ctx.pushRequest(
      {
        updateSectionStyle: {
          range: { startIndex: after - 1, endIndex: after },
          sectionStyle: ss,
          fields: fields.join(","),
        },
      },
      ["updateSectionStyle.range.startIndex", "updateSectionStyle.range.endIndex"],
    );
  }
}

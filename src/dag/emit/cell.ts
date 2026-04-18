// emitCell — called by table.ts from within a withFixedIndex scope.
//
// Each cell child MUST be { kind: "paragraph" }. Paragraphs can have multiple
// text runs with different styles. Cell content requests are pushed as
// DEFERRED (run after table structure batch). Returns cumulative char count
// written so table.ts can advance its sibling index tracking.
//
// A cell starts at cursor + 2 (the table + first cell each contribute index
// positions); the caller is responsible for seeding the cursor correctly via
// IndexCursor.withFixedIndex before invoking emitCell.

import type { CellNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import { buildTextStyle } from "./run.ts";

export function emitCell(cell: CellNode, ctx: EmitContext, _cellIndex: number): number {
  let idx = ctx.cursor.getIndex();
  const start = idx;

  // Table cells use NORMAL_TEXT style for theme application
  const prevNamedStyle = ctx.getNamedStyle();
  ctx.setNamedStyle("NORMAL_TEXT");

  for (const child of cell.children) {
    if (child.kind !== "paragraph") {
      throw new Error(`cell children must be paragraphs (got ${child.kind})`);
    }
    // Support multiple runs per paragraph
    for (const run of child.runs) {
      if (!run) continue;
      const text = run.text;
      // Cell content insertText goes to structure batch (not deferred) because
      // it must execute in document order to avoid index shifts affecting later cells.
      // The table emitter walks cells in forward order, so each cell's text is
      // inserted before subsequent cells are processed.
      ctx.pushRequest(
        { insertText: { text, location: { index: idx } } },
        ["insertText.location.index"],
      );
      const runStart = idx;
      idx += text.length;
      const ts = buildTextStyle(run);
      if (ts) {
        ctx.pushDeferred(
          {
            updateTextStyle: {
              range: { startIndex: runStart, endIndex: idx },
              textStyle: ts.style,
              fields: ts.fields.join(","),
            },
          },
          ["updateTextStyle.range.startIndex", "updateTextStyle.range.endIndex"],
        );
      }
    }
  }

  // Restore previous named style context
  ctx.setNamedStyle(prevNamedStyle);

  return idx - start;
}

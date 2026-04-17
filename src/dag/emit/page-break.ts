// emitPageBreak: insertPageBreak at cursor. Occupies 2 index positions
// (page break element + its wrapping newline).

import type { PageBreakNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";

export function emitPageBreak(_node: PageBreakNode, ctx: EmitContext): void {
  const idx = ctx.cursor.getIndex();
  ctx.pushRequest(
    { insertPageBreak: { location: { index: idx } } },
    ["insertPageBreak.location.index"],
  );
  ctx.cursor.advance(2);
}

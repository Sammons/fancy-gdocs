// emitNamedRange: record start, emit children, record end, then emit
// createNamedRange over the computed range.
//
// MVP: children limited to paragraph nodes (consistent with callout/blockquote
// MVP). A proper dispatcher will broaden this once walk.ts lands.

import type { NamedRangeNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import { emitParagraph } from "./paragraph.ts";

export function emitNamedRange(node: NamedRangeNode, ctx: EmitContext): void {
  const start = ctx.cursor.getIndex();
  for (const child of node.children) {
    if (child.kind !== "paragraph") {
      throw new Error(`namedRange children must be paragraphs (got ${child.kind}) — MVP`);
    }
    emitParagraph(child, ctx);
  }
  const end = ctx.cursor.getIndex();

  ctx.pushRequest(
    {
      createNamedRange: {
        name: node.name,
        range: { startIndex: start, endIndex: end },
      },
    },
    ["createNamedRange.range.startIndex", "createNamedRange.range.endIndex"],
  );
}

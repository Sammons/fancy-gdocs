// emitImage: insertInlineImage at cursor. Image occupies 1 index position.

import type { ImageNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";

export function emitImage(node: ImageNode, ctx: EmitContext): void {
  const idx = ctx.cursor.getIndex();
  const size: Record<string, unknown> = {};
  if (node.width != null) size.width = { magnitude: node.width, unit: "PT" };
  if (node.height != null) size.height = { magnitude: node.height, unit: "PT" };
  const req: Record<string, unknown> = {
    insertInlineImage: {
      uri: node.uri,
      location: { index: idx },
      ...(Object.keys(size).length > 0 ? { objectSize: size } : {}),
    },
  };
  ctx.pushRequest(req, ["insertInlineImage.location.index"]);
  ctx.cursor.advance(1);
}

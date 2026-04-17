// emitReplaceImage: replaceImage by objectId. No positional index math.

import type { ReplaceImageNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";

export function emitReplaceImage(node: ReplaceImageNode, ctx: EmitContext): void {
  ctx.pushRequest(
    {
      replaceImage: {
        imageObjectId: node.objectId,
        uri: node.uri,
      },
    },
    [],
  );
}

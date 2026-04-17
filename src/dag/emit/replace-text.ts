// emitReplaceText: replaceAllText request. No positional index math.

import type { ReplaceTextNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";

export function emitReplaceText(node: ReplaceTextNode, ctx: EmitContext): void {
  ctx.pushRequest(
    {
      replaceAllText: {
        containsText: { text: node.search, matchCase: node.matchCase ?? false },
        replaceText: node.replace,
      },
    },
    [],
  );
}

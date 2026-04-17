// emitList — MVP: each item is a Block[] containing exactly one
// { kind: "paragraph" }. Anything else throws "nested list content not yet
// supported". After emitting all items, a single createParagraphBullets is
// applied to the whole range covered by the items.
//
// The Block[][] schema anticipates future multi-block items (nested lists,
// images inside items, etc.); this MVP keeps scope bounded per plan.

import type { ListNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import { emitParagraph } from "./paragraph.ts";

const PRESETS: Record<string, string> = {
  BULLET: "BULLET_DISC_CIRCLE_SQUARE",
  NUMBERED: "NUMBERED_DECIMAL_ALPHA_ROMAN",
  CHECK: "BULLET_CHECKBOX",
};

export function emitList(node: ListNode, ctx: EmitContext): void {
  if (node.items.length === 0) return;
  const rangeStart = ctx.cursor.getIndex();

  for (const item of node.items) {
    if (item.length !== 1 || item[0].kind !== "paragraph") {
      throw new Error("nested list content not yet supported");
    }
    emitParagraph(item[0], ctx);
  }

  const rangeEnd = ctx.cursor.getIndex();
  const preset = PRESETS[node.style];
  if (!preset) throw new Error(`unknown list style: ${node.style}`);
  ctx.pushRequest(
    {
      createParagraphBullets: {
        range: { startIndex: rangeStart, endIndex: rangeEnd - 1 },
        bulletPreset: preset,
      },
    },
    ["createParagraphBullets.range.startIndex", "createParagraphBullets.range.endIndex"],
  );
}

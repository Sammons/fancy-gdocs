// dispatch — exhaustive switch over Block kinds.

import type { Block } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import { emitParagraph } from "./paragraph.ts";
import { emitImage } from "./image.ts";
import { emitList } from "./list.ts";
import { emitTable } from "./table.ts";
import { emitPageBreak } from "./page-break.ts";
import { emitHr } from "./hr.ts";
import { emitSectionBreak } from "./section-break.ts";
import { emitCallout } from "./callout.ts";
import { emitBlockquote } from "./blockquote.ts";
import { emitReplaceText } from "./replace-text.ts";
import { emitReplaceImage } from "./replace-image.ts";
import { emitNamedRange } from "./named-range.ts";
import { emitPullquote } from "./pullquote.ts";

export function dispatch(node: Block, ctx: EmitContext): void {
  switch (node.kind) {
    case "paragraph": return emitParagraph(node, ctx);
    case "image": return emitImage(node, ctx);
    case "list": return emitList(node, ctx);
    case "table": return emitTable(node, ctx);
    case "pageBreak": return emitPageBreak(node, ctx);
    case "hr": return emitHr(node, ctx);
    case "sectionBreak": return emitSectionBreak(node, ctx);
    case "callout": return emitCallout(node, ctx);
    case "blockquote": return emitBlockquote(node, ctx);
    case "replaceText": return emitReplaceText(node, ctx);
    case "replaceImage": return emitReplaceImage(node, ctx);
    case "namedRange": return emitNamedRange(node, ctx);
    case "pullquote": return emitPullquote(node, ctx);
    default: {
      const _exhaustive: never = node;
      throw new Error(`dispatch: unknown block kind ${(node as { kind: string }).kind}`);
    }
  }
}

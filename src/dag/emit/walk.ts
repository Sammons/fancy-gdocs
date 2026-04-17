// walk — top-level driver. Produces one segment per body/tab/header/footer.

import type { DocSpec, DocStyleSpec, HeaderFooterSpec } from "../types/doc-spec.ts";
import type { Block } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import { collect } from "./collect.ts";
import { dispatch } from "./index.ts";

export function walk(doc: DocSpec, ctx: EmitContext): void {
  if (doc.tabs && doc.tabs.length > 0) {
    // Walk all tabs including nested children
    walkTabs(doc.tabs, ctx, doc.docStyle, undefined, true);
  } else {
    ctx.openSegment();
    if (doc.docStyle) pushDocStyle(ctx, doc.docStyle);
    if (doc.blocks) emitBlocks(doc.blocks, ctx);
  }

  // Header/footer emit (only in main walk, after all tabs)
  emitHeaderFooter(ctx, "createHeader", doc.header);
  emitHeaderFooter(ctx, "createFooter", doc.footer);
  emitHeaderFooter(ctx, "createHeader", doc.firstPageHeader, true);
  emitHeaderFooter(ctx, "createFooter", doc.firstPageFooter, true);
}

/** Recursively walk tabs with consistent placeholder IDs matching create code */
function walkTabs(
  tabs: NonNullable<DocSpec["tabs"]>,
  ctx: EmitContext,
  docStyle: DocStyleSpec | undefined,
  parentId: string | undefined,
  isFirst: boolean,
): void {
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    // Generate placeholder ID matching the create code's flattenTabs logic
    const tabId = parentId
      ? `${parentId}-child-${i}`
      : `tab-${i}`;
    ctx.scope.push({ tabId });
    ctx.openSegment();
    // Apply docStyle only to the very first tab segment
    if (isFirst && i === 0 && docStyle) pushDocStyle(ctx, docStyle);
    emitBlocks(tab.blocks, ctx);
    ctx.scope.pop();

    // Recursively emit child tabs
    if (tab.children && tab.children.length > 0) {
      walkTabs(tab.children, ctx, undefined, tabId, false);
    }
  }
}

function emitBlocks(blocks: Block[], ctx: EmitContext): void {
  for (const b of blocks) collect(b, ctx);
  for (const b of blocks) dispatch(b, ctx);
}

function emitHeaderFooter(
  ctx: EmitContext,
  kind: "createHeader" | "createFooter",
  spec: HeaderFooterSpec | undefined,
  firstPage = false,
): void {
  if (!spec) return;
  const type = firstPage ? "FIRST_PAGE_HEADER" : (kind === "createHeader" ? "DEFAULT" : "DEFAULT");
  const segmentId = `${kind}-${firstPage ? "first" : "default"}`;
  ctx.pushRequest({ [kind]: { type } }, []);
  ctx.scope.push({ segmentId });
  ctx.openSegment();
  emitBlocks(spec.blocks, ctx);
  ctx.scope.pop();
}

function pushDocStyle(ctx: EmitContext, style: DocStyleSpec): void {
  const docStyle: Record<string, unknown> = {};
  const fields: string[] = [];
  const points = (n: number) => ({ magnitude: n, unit: "PT" });
  if (style.marginTop != null) { docStyle.marginTop = points(style.marginTop); fields.push("marginTop"); }
  if (style.marginBottom != null) { docStyle.marginBottom = points(style.marginBottom); fields.push("marginBottom"); }
  if (style.marginLeft != null) { docStyle.marginLeft = points(style.marginLeft); fields.push("marginLeft"); }
  if (style.marginRight != null) { docStyle.marginRight = points(style.marginRight); fields.push("marginRight"); }
  if (style.pageWidth != null) { docStyle.pageSize = { ...(docStyle.pageSize as object ?? {}), width: points(style.pageWidth) }; fields.push("pageSize"); }
  if (style.pageHeight != null) { docStyle.pageSize = { ...(docStyle.pageSize as object ?? {}), height: points(style.pageHeight) }; if (!fields.includes("pageSize")) fields.push("pageSize"); }
  if (style.background) {
    const hex = style.background.replace("#", "");
    const colorValue = parseInt(hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex, 16);
    const rgb = { red: ((colorValue >> 16) & 0xff) / 255, green: ((colorValue >> 8) & 0xff) / 255, blue: (colorValue & 0xff) / 255 };
    docStyle.background = { color: { color: { rgbColor: rgb } } };
    fields.push("background");
  }
  if (fields.length === 0) return;
  ctx.pushRequest(
    { updateDocumentStyle: { documentStyle: docStyle, fields: fields.join(",") } },
    [],
  );
}

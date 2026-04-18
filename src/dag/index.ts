// Public facade for the gdocs DAG pipeline.

import { EmitContext } from "./ir/emit-context.ts";
import { IndexCursor } from "./ir/index-cursor.ts";
import { SegmentScope } from "./ir/segment-scope.ts";
import { DocumentRegistry } from "./ir/document-registry.ts";
import { walk } from "./emit/walk.ts";
import { applyTheme } from "./theme/apply.ts";
import type { DocSpec } from "./types/doc-spec.ts";
import type { ThemeSpec } from "./theme/theme-spec.ts";
import type { DocIR } from "./ir/doc-ir.ts";

export interface CompileResult {
  ir: DocIR;
  registry: DocumentRegistry;
}

export function compileDoc(spec: DocSpec, theme?: ThemeSpec): CompileResult {
  // Cursor starts at 0 (segment-relative). Rebase adds origin (1 for body, 0 for headers).
  // Pass theme to EmitContext so emitters can apply theme-specific styling (e.g., table headers).
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry(), theme);
  walk(spec, ctx);
  const ir = ctx.buildIR();
  const themedIr = theme ? applyTheme(ir, theme) : ir;
  return { ir: themedIr, registry: ctx.registry };
}

export { applyTheme } from "./theme/apply.ts";
export { rebase, segmentKey } from "./call-maker/rebase.ts";
export { batchSplit } from "./call-maker/batch.ts";
export { executeIR } from "./call-maker/execute.ts";
export { EmitContext } from "./ir/emit-context.ts";
export { DocumentRegistry } from "./ir/document-registry.ts";
export type { FootnoteSpec, PendingAnchorLink, AnchorLocation } from "./ir/document-registry.ts";
export type { FetchClient } from "./call-maker/execute.ts";
export type { DocSpec } from "./types/doc-spec.ts";
export type { ThemeSpec } from "./theme/theme-spec.ts";
export type { DocIR } from "./ir/doc-ir.ts";

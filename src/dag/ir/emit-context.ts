import { IndexCursor } from "./index-cursor.ts";
import { SegmentScope } from "./segment-scope.ts";
import { DocumentRegistry } from "./document-registry.ts";
import { makeRequest, type DocIR, type Segment, type SegmentRelativeRequest } from "./doc-ir.ts";
import type { NamedStyleType, ThemeSpec } from "../theme/theme-spec.ts";

export class EmitContext {
  readonly cursor: IndexCursor;
  readonly scope: SegmentScope;
  readonly registry: DocumentRegistry;
  readonly theme: ThemeSpec | undefined;
  #segments: Segment[] = [];
  #current: Segment | undefined;
  #lastTabId: string | undefined = undefined;
  /** Current paragraph's named style type — set by paragraph emitter for theme application */
  #currentNamedStyle: NamedStyleType | undefined = undefined;

  constructor(cursor: IndexCursor, scope: SegmentScope, registry: DocumentRegistry, theme?: ThemeSpec) {
    this.cursor = cursor;
    this.scope = scope;
    this.registry = registry;
    this.theme = theme;
  }

  openSegment(): void {
    const seg: Segment = {
      segmentId: this.scope.getSegmentId(),
      tabId: this.scope.getTabId(),
      localRequests: [],
      deferredRequests: [],
    };
    this.#segments.push(seg);
    this.#current = seg;

    // Reset cursor when switching to a different tab (each tab has its own index space)
    // IR indices are relative to 0; rebase() adds the origin (1 for body, 0 for header/footer)
    if (seg.tabId !== this.#lastTabId) {
      this.cursor.reset(0);
      this.#lastTabId = seg.tabId;
    }
  }

  /** Set the current paragraph's named style type for theme application */
  setNamedStyle(style: NamedStyleType | undefined): void {
    this.#currentNamedStyle = style;
  }

  /** Get the current paragraph's named style type */
  getNamedStyle(): NamedStyleType | undefined {
    return this.#currentNamedStyle;
  }

  pushRequest(request: Record<string, unknown>, indexFields: string[]): void {
    if (!this.#current) throw new Error("EmitContext.pushRequest: no open segment — call openSegment() first");
    this.#current.localRequests.push(makeRequest(request, indexFields, this.#currentNamedStyle));
  }

  pushDeferred(request: Record<string, unknown>, indexFields: string[]): void {
    if (!this.#current) throw new Error("EmitContext.pushDeferred: no open segment — call openSegment() first");
    this.#current.deferredRequests.push(makeRequest(request, indexFields, this.#currentNamedStyle));
  }

  buildIR(): DocIR {
    return { segments: this.#segments.slice() };
  }
}

export type { SegmentRelativeRequest };

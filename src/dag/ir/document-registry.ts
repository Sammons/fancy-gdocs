import type { Run } from "../types/run.ts";

export interface AnchorLocation {
  segmentId?: string;
  tabId?: string;
  index: number;
}

export interface OutlineEntry {
  level: number;
  text: string;
  anchorId: string;
}

export interface FootnoteSpec {
  /** Index in the body where createFootnote should be called. */
  bodyIndex: number;
  /** Content runs for the footnote body. */
  content: Run[];
  /** Assigned footnote number (1, 2, 3...). */
  footnoteNumber: number;
  /** Tab ID (for multi-tab docs). */
  tabId?: string;
}

export interface PendingAnchorLink {
  /** Range where the link should be applied in phase 2. */
  range: { startIndex: number; endIndex: number };
  /** Tab ID for multi-tab docs. */
  tabId?: string;
  /** Anchor name to link to (matches anchorId on a heading). */
  anchorName: string;
}

export class DocumentRegistry {
  #anchors = new Map<string, AnchorLocation>();
  #outline: OutlineEntry[] = [];
  #footnoteCounter = 0;
  #listCounters = new Map<string, number>();
  #footnotes: FootnoteSpec[] = [];
  #pendingAnchorLinks: PendingAnchorLink[] = [];

  registerAnchor(id: string, loc: AnchorLocation): void {
    if (this.#anchors.has(id)) throw new Error(`Duplicate anchor id: ${id}`);
    this.#anchors.set(id, { ...loc });
  }

  resolveAnchor(id: string): AnchorLocation | undefined {
    return this.#anchors.get(id);
  }

  /** Returns all registered anchors as a map from user-defined anchorId to AnchorLocation. */
  getAnchors(): Map<string, AnchorLocation> {
    return new Map(this.#anchors);
  }

  addOutlineEntry(entry: OutlineEntry): void {
    this.#outline.push({ ...entry });
  }

  getOutline(): OutlineEntry[] {
    return this.#outline.slice();
  }

  nextFootnoteNumber(): number {
    return ++this.#footnoteCounter;
  }

  registerFootnote(bodyIndex: number, content: Run[], tabId?: string): FootnoteSpec {
    const spec: FootnoteSpec = {
      bodyIndex,
      content,
      footnoteNumber: this.nextFootnoteNumber(),
      tabId,
    };
    this.#footnotes.push(spec);
    return spec;
  }

  getPendingFootnotes(): FootnoteSpec[] {
    return this.#footnotes.slice();
  }

  nextListItem(listId: string): number {
    const n = (this.#listCounters.get(listId) ?? 0) + 1;
    this.#listCounters.set(listId, n);
    return n;
  }

  resetList(listId: string): void {
    this.#listCounters.delete(listId);
  }

  registerPendingAnchorLink(link: PendingAnchorLink): void {
    this.#pendingAnchorLinks.push({ ...link });
  }

  getPendingAnchorLinks(): PendingAnchorLink[] {
    return this.#pendingAnchorLinks.slice();
  }
}

// rebase — resolves segment-relative indices to absolute indices and
// sprinkles segmentId / tabId onto each parent location/range object.
//
// Returns [structureRequests, deferredRequests] — two flat arrays across
// all segments in segment order. CallMaker sends structure first, then
// deferred.

import type { DocIR, SegmentRelativeRequest, Segment } from "../ir/doc-ir.ts";

export function segmentKey(tabId: string | undefined, segmentId: string | undefined): string {
  return `${tabId ?? ""}|${segmentId ?? ""}`;
}

export function rebase(
  docIR: DocIR,
  absoluteOrigins: Record<string, number>,
): [Record<string, unknown>[], Record<string, unknown>[]] {
  const structure: Record<string, unknown>[] = [];
  const deferred: Record<string, unknown>[] = [];
  for (const seg of docIR.segments) {
    const key = segmentKey(seg.tabId, seg.segmentId);
    const origin = absoluteOrigins[key];
    if (origin === undefined) {
      throw new Error(`rebase: no origin for segmentKey ${key}`);
    }
    for (const r of seg.localRequests) structure.push(rebaseOne(r, origin, seg));
    for (const r of seg.deferredRequests) deferred.push(rebaseOne(r, origin, seg));
  }
  return [structure, deferred];
}

function rebaseOne(r: SegmentRelativeRequest, origin: number, seg: Segment): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(r.request)) as Record<string, unknown>;
  for (const field of r.indexFields) {
    const parts = field.split(".");
    const leaf = parts.pop()!; // "index" / "startIndex" / "endIndex"
    let obj: any = clone;
    for (const p of parts) obj = obj[p];
    if (typeof obj[leaf] === "number") obj[leaf] += origin;
    if (seg.segmentId !== undefined) obj.segmentId = seg.segmentId;
    if (seg.tabId !== undefined) obj.tabId = seg.tabId;
  }
  return clone;
}

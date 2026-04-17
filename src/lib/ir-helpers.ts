// IR manipulation helpers for gdocs skill.

import type { DocIR } from "../dag/index.ts";

/** Extract all requests from a DocIR for pre-processing (e.g., SVG resolution). */
export function extractRequestsFromIR(ir: DocIR): Record<string, unknown>[] {
  const requests: Record<string, unknown>[] = [];
  for (const seg of ir.segments) {
    for (const r of seg.localRequests) requests.push(r.request);
    for (const r of seg.deferredRequests) requests.push(r.request);
  }
  return requests;
}

/** Remap placeholder tabIds in the IR to real tabIds from the Google Docs API. */
export function remapTabIds(ir: DocIR, tabIdMap: Record<string, string | undefined>): void {
  for (const seg of ir.segments) {
    if (seg.tabId !== undefined && seg.tabId in tabIdMap) {
      // tabIdMap["tab-0"] = undefined means "use default tab" (no tabId needed)
      // tabIdMap["tab-1"] = "t.xyz" means use real tabId
      seg.tabId = tabIdMap[seg.tabId];
    }
  }
}

/** Header/footer placeholder segment IDs emitted by DAG walk. */
const HEADER_FOOTER_SEGMENT_IDS = new Set([
  "createHeader-default",
  "createFooter-default",
  "createHeader-first",
  "createFooter-first",
]);

/**
 * Filter out header/footer segments and createHeader/createFooter requests from the IR.
 * These require special handling: createHeader/createFooter must be called first to get
 * the real segment ID, then content is inserted using that ID. The DAG emits placeholder
 * segment IDs which don't exist until after the API call.
 */
export function filterHeaderFooterFromIR(ir: DocIR): DocIR {
  // Filter out header/footer segments
  const filteredSegments = ir.segments.filter(
    seg => !seg.segmentId || !HEADER_FOOTER_SEGMENT_IDS.has(seg.segmentId)
  );

  // Filter out createHeader/createFooter requests from remaining segments
  for (const seg of filteredSegments) {
    seg.localRequests = seg.localRequests.filter(r => {
      const req = r.request as Record<string, unknown>;
      return !req.createHeader && !req.createFooter;
    });
    seg.deferredRequests = seg.deferredRequests.filter(r => {
      const req = r.request as Record<string, unknown>;
      return !req.createHeader && !req.createFooter;
    });
  }

  return { segments: filteredSegments };
}

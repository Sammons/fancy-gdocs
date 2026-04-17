// executeIR — glue from DocIR to google docs batchUpdate calls.
// Structure batches first, deferred second. Client must expose `fetch` a la
// zapier.

import type { DocIR } from "../ir/doc-ir.ts";
import type { ThemeSpec } from "../theme/theme-spec.ts";
import { applyTheme } from "../theme/apply.ts";
import { rebase, segmentKey } from "./rebase.ts";
import { batchSplit } from "./batch.ts";

export interface FetchClient {
  fetch(url: string, opts?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<{ ok: boolean; json(): Promise<unknown>; text?: () => Promise<string> }>;
}

/** Extract the highest index from a request (for sorting deferred requests). */
function extractMaxIndex(req: Record<string, unknown>): number {
  let max = -1;
  const walk = (obj: unknown): void => {
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        if ((k === "index" || k === "startIndex" || k === "endIndex") && typeof v === "number") {
          if (v > max) max = v;
        } else {
          walk(v);
        }
      }
    }
  };
  walk(req);
  return max;
}

export async function executeIR(
  docIR: DocIR,
  client: FetchClient,
  theme: ThemeSpec | undefined,
  _connection: string,
  documentId: string,
): Promise<void> {
  const themed = theme ? applyTheme(docIR, theme) : docIR;
  const origins: Record<string, number> = {};
  for (const seg of themed.segments) {
    const key = segmentKey(seg.tabId, seg.segmentId);
    // body starts at 1; header/footer at 0.
    origins[key] = seg.segmentId === undefined ? 1 : 0;
  }
  const [structure, deferred] = rebase(themed, origins);

  // Sort deferred requests by index descending so higher-index insertions
  // happen first and don't shift indices for lower-index insertions.
  deferred.sort((a, b) => {
    const idxA = extractMaxIndex(a);
    const idxB = extractMaxIndex(b);
    return idxB - idxA;
  });

  const url = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`;
  for (const batch of batchSplit(structure)) {
    const res = await client.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests: batch }),
    });
    if (!res.ok) {
      const errText = res.text ? await res.text() : JSON.stringify(await res.json());
      throw new Error(`executeIR structure batchUpdate failed: ${errText}`);
    }
  }
  for (const batch of batchSplit(deferred)) {
    const res = await client.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests: batch }),
    });
    if (!res.ok) {
      const errText = res.text ? await res.text() : JSON.stringify(await res.json());
      throw new Error(`executeIR deferred batchUpdate failed: ${errText}`);
    }
  }
}

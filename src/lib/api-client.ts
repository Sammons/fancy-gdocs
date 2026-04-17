// Google Docs API client via Zapier SDK relay.

import { execFileSync } from "node:child_process";
import { createZapierSdk } from "@zapier/zapier-sdk";
import type { FetchClient } from "../dag/index.ts";

const DOCS_API = "https://docs.googleapis.com/v1/documents";

const zapier = createZapierSdk();

/** Cache for auto-detected connection ID. */
let cachedConnectionId: string | undefined;

export function fail(msg: string): never {
  throw new Error(msg);
}

/** Resolve a Zapier connection ID for Google Docs. Checks env vars first, then auto-detects. */
export async function resolveConnectionId(account: string): Promise<string> {
  // 1. Account-specific env var: GDOCS_CONNECTION_WORK / GDOCS_CONNECTION_PERSONAL
  const specific = process.env[`GDOCS_CONNECTION_${account.toUpperCase()}`];
  if (specific) return specific;

  // 2. Generic env var
  const fallback = process.env.GDOCS_CONNECTION;
  if (fallback) return fallback;

  // 3. Auto-detect via CLI: npx zapier-sdk find-first-connection google_docs
  if (cachedConnectionId) return cachedConnectionId;
  try {
    const out = execFileSync("npx", ["zapier-sdk", "find-first-connection", "google_docs", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
    const parsed = JSON.parse(out);
    const id = parsed?.data?.id ?? parsed?.id;
    if (id) {
      cachedConnectionId = String(id);
      console.error(`Auto-detected Google Docs connection: ${cachedConnectionId}`);
      return cachedConnectionId;
    }
  } catch { /* auto-detect failed, will prompt user */ }

  fail(
    `No Zapier Google Docs connection found. Either:\n` +
    `  1. Create one at https://zapier.com/app/assets/connections\n` +
    `  2. Set GDOCS_CONNECTION env var manually`
  );
}

export async function createBlankDoc(title: string, connection: string): Promise<any> {
  const res = await zapier.fetch(DOCS_API, {
    method: "POST",
    connection,
    body: JSON.stringify({ title }),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) fail(`docs.create failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function batchUpdate(
  documentId: string,
  requests: Record<string, unknown>[],
  connection: string,
): Promise<any> {
  const res = await zapier.fetch(`${DOCS_API}/${documentId}:batchUpdate`, {
    method: "POST",
    connection,
    body: JSON.stringify({ requests }),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) fail(`batchUpdate failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function getDoc(documentId: string, connection: string): Promise<any> {
  const res = await zapier.fetch(
    `${DOCS_API}/${documentId}?includeTabsContent=true`,
    { method: "GET", connection },
  );
  if (!res.ok) fail(`documents.get failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/** Create a FetchClient adapter that wraps zapier.fetch with a connection header. */
export function createFetchClient(connection: string): FetchClient {
  return {
    async fetch(url, opts) {
      const res = await zapier.fetch(url, {
        method: opts?.method ?? "GET",
        connection,
        body: opts?.body,
        headers: opts?.headers as Record<string, string> | undefined,
      });
      return {
        ok: res.ok,
        async json() {
          return res.json();
        },
        async text() {
          return res.text();
        },
      };
    },
  };
}

export { zapier };

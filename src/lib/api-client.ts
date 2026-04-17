// Google Docs API client with multi-backend auth support.
// Priority: GOOGLE_ACCESS_TOKEN → Service Account → ADC → Zapier SDK

import { execFileSync, execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import type { FetchClient } from "../dag/index.ts";

const DOCS_API = "https://docs.googleapis.com/v1/documents";

export type AuthProvider = "token" | "service-account" | "adc" | "zapier";

interface AuthResult {
  provider: AuthProvider;
  client: FetchClient;
}

/** Cached auth result. */
let cachedAuth: AuthResult | undefined;

export function fail(msg: string): never {
  throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Auth Provider Chain
// ---------------------------------------------------------------------------

/** Create authenticated FetchClient using best available method. */
export async function createAuthClient(account?: string): Promise<AuthResult> {
  if (cachedAuth) return cachedAuth;

  // 1. Direct access token (short-lived, for scripts/CI)
  const directToken = process.env.GOOGLE_ACCESS_TOKEN;
  if (directToken) {
    console.error("[auth] Using GOOGLE_ACCESS_TOKEN");
    cachedAuth = { provider: "token", client: createBearerClient(directToken) };
    return cachedAuth;
  }

  // 2. Service Account JSON key file
  const saKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (saKeyPath && existsSync(saKeyPath)) {
    console.error(`[auth] Using service account from ${saKeyPath}`);
    const token = await getServiceAccountToken(saKeyPath);
    cachedAuth = { provider: "service-account", client: createBearerClient(token) };
    return cachedAuth;
  }

  // 3. Application Default Credentials (gcloud auth application-default login)
  const adcToken = tryGetAdcToken();
  if (adcToken) {
    console.error("[auth] Using gcloud ADC");
    cachedAuth = { provider: "adc", client: createBearerClient(adcToken) };
    return cachedAuth;
  }

  // 4. Zapier SDK fallback
  console.error("[auth] Using Zapier SDK");
  const zapierClient = await createZapierClient(account);
  cachedAuth = { provider: "zapier", client: zapierClient };
  return cachedAuth;
}

/** Create a simple Bearer token FetchClient. */
function createBearerClient(token: string): FetchClient {
  return {
    async fetch(url, opts) {
      const res = await fetch(url, {
        method: opts?.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...opts?.headers,
          Authorization: `Bearer ${token}`,
        },
        body: opts?.body,
      });
      return {
        ok: res.ok,
        async json() { return res.json(); },
        async text() { return res.text(); },
      };
    },
  };
}

/** Get access token from service account JSON key. */
async function getServiceAccountToken(keyPath: string): Promise<string> {
  const keyData = JSON.parse(readFileSync(keyPath, "utf8"));
  const { client_email, private_key } = keyData;

  if (!client_email || !private_key) {
    throw new Error(`Invalid service account key: missing client_email or private_key`);
  }

  // Create JWT for token exchange
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const jwt = await signJwt(header, payload, private_key);

  // Exchange JWT for access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Service account token exchange failed: ${await res.text()}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/** Sign JWT using native Node crypto. */
async function signJwt(
  header: Record<string, string>,
  payload: Record<string, unknown>,
  privateKey: string,
): Promise<string> {
  const { createSign } = await import("node:crypto");

  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const headerB64 = b64url(header);
  const payloadB64 = b64url(payload);
  const unsigned = `${headerB64}.${payloadB64}`;

  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(privateKey, "base64url");

  return `${unsigned}.${signature}`;
}

/** Try to get ADC token via gcloud. Returns undefined if not available. */
function tryGetAdcToken(): string | undefined {
  try {
    const token = execSync("gcloud auth application-default print-access-token 2>/dev/null", {
      encoding: "utf8",
      timeout: 10_000,
    }).trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Zapier SDK (lazy loaded)
// ---------------------------------------------------------------------------

/** Cache for auto-detected Zapier connection ID. */
let cachedConnectionId: string | undefined;

/** Resolve a Zapier connection ID for Google Docs. */
export async function resolveConnectionId(account: string): Promise<string> {
  // 1. Account-specific env var: GDOCS_CONNECTION_WORK / GDOCS_CONNECTION_PERSONAL
  const specific = process.env[`GDOCS_CONNECTION_${account.toUpperCase()}`];
  if (specific) return specific;

  // 2. Generic env var
  const fallback = process.env.GDOCS_CONNECTION;
  if (fallback) return fallback;

  // 3. Auto-detect via CLI
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
  } catch { /* auto-detect failed */ }

  fail(
    `No Zapier Google Docs connection found. Either:\n` +
    `  1. Create one at https://zapier.com/app/assets/connections\n` +
    `  2. Set GDOCS_CONNECTION env var manually`
  );
}

/** Try to resolve Zapier SDK from various locations. */
async function tryResolveZapierSdk(): Promise<{ createZapierSdk: () => any } | null> {
  const { createRequire } = await import("node:module");
  const { existsSync } = await import("node:fs");
  const { homedir } = await import("node:os");

  // Locations to check for Zapier SDK
  const searchPaths = [
    // 1. Local node_modules (if running from source)
    process.cwd(),
    // 2. claude_home (known location)
    `${homedir()}/Desktop/claude_home`,
    // 3. Global mise/node modules
    `${homedir()}/.local/share/mise/installs/node`,
  ];

  for (const basePath of searchPaths) {
    try {
      // Check if path exists before requiring
      const sdkPath = `${basePath}/node_modules/@zapier/zapier-sdk`;
      const loginPath = `${basePath}/node_modules/@zapier/zapier-sdk-cli-login`;

      if (existsSync(sdkPath) && existsSync(loginPath)) {
        // Create a require function rooted at this path
        const localRequire = createRequire(`${basePath}/package.json`);

        // Pre-load cli-login so SDK can find credentials
        localRequire("@zapier/zapier-sdk-cli-login");
        const { createZapierSdk } = localRequire("@zapier/zapier-sdk");

        console.error(`[auth] Found Zapier SDK at ${basePath}`);
        return { createZapierSdk };
      }
    } catch {
      // This path didn't work, try next
    }
  }

  // Try direct import as last resort (works if bundled with deps)
  try {
    await import("@zapier/zapier-sdk-cli-login");
    const { createZapierSdk } = await import("@zapier/zapier-sdk");
    console.error("[auth] Found Zapier SDK via direct import");
    return { createZapierSdk };
  } catch {
    return null;
  }
}

/** Create Zapier SDK client (dynamically resolves SDK from system). */
async function createZapierClient(account?: string): Promise<FetchClient> {
  const sdk = await tryResolveZapierSdk();
  if (!sdk) {
    fail(
      "Zapier SDK not found. Install it globally or use another auth method:\n" +
      "  1. npm install -g @zapier/zapier-sdk @zapier/zapier-sdk-cli-login\n" +
      "  2. Or set GOOGLE_SERVICE_ACCOUNT_KEY or use gcloud ADC"
    );
  }

  const zapier = sdk.createZapierSdk();
  const connection = await resolveConnectionId(account ?? "default");

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
        async json() { return res.json(); },
        async text() { return res.text(); },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// High-level API (uses auth provider chain)
// ---------------------------------------------------------------------------

/** Create a blank Google Doc. Returns the document response. */
export async function createBlankDoc(title: string, _connection?: string): Promise<any> {
  const { client } = await createAuthClient();
  const res = await client.fetch(DOCS_API, {
    method: "POST",
    body: JSON.stringify({ title }),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) fail(`docs.create failed: ${await res.text?.() ?? "unknown error"}`);
  return res.json();
}

/** Execute a batchUpdate on a document. */
export async function batchUpdate(
  documentId: string,
  requests: Record<string, unknown>[],
  _connection?: string,
): Promise<any> {
  const { client } = await createAuthClient();
  const res = await client.fetch(`${DOCS_API}/${documentId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) fail(`batchUpdate failed: ${await res.text?.() ?? "unknown error"}`);
  return res.json();
}

/** Get a document by ID. */
export async function getDoc(documentId: string, _connection?: string): Promise<any> {
  const { client } = await createAuthClient();
  const res = await client.fetch(
    `${DOCS_API}/${documentId}?includeTabsContent=true`,
    { method: "GET" },
  );
  if (!res.ok) fail(`documents.get failed: ${await res.text?.() ?? "unknown error"}`);
  return res.json();
}

/** Create a FetchClient using the auth provider chain. */
export async function createFetchClient(_connection?: string): Promise<FetchClient> {
  const { client } = await createAuthClient();
  return client;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/** Print available auth methods for troubleshooting. */
export function printAuthDiagnostics(): void {
  console.error("\n[auth] Checking available authentication methods:\n");

  if (process.env.GOOGLE_ACCESS_TOKEN) {
    console.error("  ✓ GOOGLE_ACCESS_TOKEN is set");
  } else {
    console.error("  ✗ GOOGLE_ACCESS_TOKEN not set");
  }

  const saPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (saPath && existsSync(saPath)) {
    console.error(`  ✓ Service account key exists at ${saPath}`);
  } else if (saPath) {
    console.error(`  ✗ GOOGLE_SERVICE_ACCOUNT_KEY set but file not found: ${saPath}`);
  } else {
    console.error("  ✗ GOOGLE_SERVICE_ACCOUNT_KEY not set");
  }

  const adcToken = tryGetAdcToken();
  if (adcToken) {
    console.error("  ✓ gcloud ADC is configured");
  } else {
    console.error("  ✗ gcloud ADC not available (run: gcloud auth application-default login)");
  }

  try {
    execFileSync("npx", ["zapier-sdk", "find-first-connection", "google_docs", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
    console.error("  ✓ Zapier SDK connection available");
  } catch {
    console.error("  ✗ Zapier SDK connection not found");
  }

  console.error("");
}

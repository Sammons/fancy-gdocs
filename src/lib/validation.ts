/**
 * Round-trip validation helpers for Google Docs comparison.
 * Used by the `validate` command to compare two docs created from the same spec.
 */

// ---------------------------------------------------------------------------
// Strip keys for normalization
// ---------------------------------------------------------------------------

/** Keys to strip from docs.get responses before comparison. */
const STRIP_KEYS = new Set([
  "startIndex", "endIndex", "documentId", "revisionId",
  "tabId", "suggestedInsertionIds", "suggestedDeletionIds",
  "suggestedTextStyleChanges", "suggestedParagraphStyleChanges",
  "suggestedTableCellStyleChanges", "suggestedTableRowStyleChanges",
  "inlineObjectId", // auto-generated ID, differs between docs
  "headingId", // auto-generated per heading, differs between docs
  "headerId", // auto-generated per header segment, differs between docs
  "listId", // auto-generated per list, differs between docs
  "personId", // auto-generated per person mention, differs between docs
  "objectId", // auto-generated per inline object, differs between docs
  "footerId", // auto-generated per footer, differs between docs
  "contentUri", // auto-generated GCS image URI, differs between docs
  "defaultHeaderId", // auto-assigned in documentStyle, differs between docs
  "defaultFooterId", // auto-assigned in documentStyle, differs between docs
]);

// ---------------------------------------------------------------------------
// Deep strip
// ---------------------------------------------------------------------------

/**
 * Recursively strip auto-generated keys from an object for comparison.
 */
export function deepStrip(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(deepStrip);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (STRIP_KEYS.has(key)) continue;
      result[key] = deepStrip(value);
    }
    return result;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

/**
 * Sort objects by their JSON representation.
 * Pre-computes JSON.stringify once per element (O(n)) instead of
 * calling it in every comparison (O(n log n) calls).
 */
function sortByJson<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, json: JSON.stringify(item) }))
    .sort((a, b) => a.json.localeCompare(b.json))
    .map(({ item }) => item);
}

// ---------------------------------------------------------------------------
// Extract comparable content
// ---------------------------------------------------------------------------

interface GoogleDocsTab {
  tabProperties?: { title?: string; index?: number };
  documentTab?: {
    body?: { content?: unknown[] };
    lists?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    footers?: Record<string, unknown>;
    inlineObjects?: Record<string, unknown>;
    documentStyle?: Record<string, unknown>;
  };
}

interface GoogleDocsDocument {
  tabs?: GoogleDocsTab[];
}

/**
 * Extract a normalized, comparable representation of document content.
 * Strips auto-generated IDs and normalizes lists/headers/footers for comparison.
 */
export function extractComparableContent(doc: GoogleDocsDocument): unknown {
  const tabs = doc.tabs ?? [];
  // Note: doc.title is excluded because validate intentionally uses different
  // titles (suffixed with A/B). We compare tab structure and content only.
  return {
    tabs: tabs.map((tab) => {
      const dt = tab.documentTab ?? {};

      // Normalize lists: strip auto-generated kix.* keys, compare only the
      // list property structures (sorted by nesting level config).
      const rawLists = dt.lists ?? {};
      const normalizedLists = sortByJson(Object.values(rawLists).map((list) => deepStrip(list)));

      // Normalize headers/footers: strip kix.* keys, compare by content.
      const normalizedHeaders = sortByJson(Object.values(dt.headers ?? {}).map((h) => deepStrip(h)));
      const normalizedFooters = sortByJson(Object.values(dt.footers ?? {}).map((f) => deepStrip(f)));

      // Normalize inline objects: strip kix.* keys, compare by content.
      const normalizedInlineObjects = sortByJson(Object.values(dt.inlineObjects ?? {}).map((o) => deepStrip(o)));

      return {
        title: tab.tabProperties?.title,
        index: tab.tabProperties?.index,
        content: deepStrip(dt.body?.content ?? []),
        lists: normalizedLists,
        headers: normalizedHeaders.length > 0 ? normalizedHeaders : undefined,
        footers: normalizedFooters.length > 0 ? normalizedFooters : undefined,
        inlineObjects: normalizedInlineObjects.length > 0 ? normalizedInlineObjects : undefined,
        documentStyle: deepStrip(dt.documentStyle ?? {}),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Deep equal
// ---------------------------------------------------------------------------

/**
 * Deep comparison of two values, returning a list of path differences.
 */
export function deepEqual(a: unknown, b: unknown, path = ""): string[] {
  const diffs: string[] = [];

  if (a === b) return diffs;
  if (typeof a !== typeof b) {
    diffs.push(`${path}: type mismatch (${typeof a} vs ${typeof b})`);
    return diffs;
  }
  if (a === null || b === null) {
    if (a !== b) diffs.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    return diffs;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      diffs.push(`${path}: array length ${a.length} vs ${b.length}`);
    }
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...deepEqual(a[i], b[i], `${path}[${i}]`));
    }
    return diffs;
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of allKeys) {
      if (!(key in aObj)) {
        diffs.push(`${path}.${key}: missing in doc A`);
      } else if (!(key in bObj)) {
        diffs.push(`${path}.${key}: missing in doc B`);
      } else {
        diffs.push(...deepEqual(aObj[key], bObj[key], `${path}.${key}`));
      }
    }
    return diffs;
  }

  // Primitive comparison
  if (a !== b) {
    diffs.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
  return diffs;
}

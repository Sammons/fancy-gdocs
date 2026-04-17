import { describe, it } from "node:test";
import assert from "node:assert";
import { deepStrip, extractComparableContent, deepEqual } from "./validation.ts";

describe("deepStrip", () => {
  it("returns null for null input", () => {
    assert.strictEqual(deepStrip(null), null);
  });

  it("returns undefined for undefined input", () => {
    assert.strictEqual(deepStrip(undefined), undefined);
  });

  it("returns primitives unchanged", () => {
    assert.strictEqual(deepStrip(42), 42);
    assert.strictEqual(deepStrip("hello"), "hello");
    assert.strictEqual(deepStrip(true), true);
  });

  it("strips startIndex and endIndex", () => {
    const obj = { startIndex: 0, endIndex: 10, text: "hello" };
    assert.deepStrictEqual(deepStrip(obj), { text: "hello" });
  });

  it("strips documentId and revisionId", () => {
    const obj = { documentId: "abc123", revisionId: "xyz", title: "Doc" };
    assert.deepStrictEqual(deepStrip(obj), { title: "Doc" });
  });

  it("strips tabId", () => {
    const obj = { tabId: "tab-0", content: "text" };
    assert.deepStrictEqual(deepStrip(obj), { content: "text" });
  });

  it("strips auto-generated IDs", () => {
    const obj = {
      headingId: "h1",
      headerId: "hdr1",
      listId: "list1",
      footerId: "ftr1",
      personId: "p1",
      objectId: "obj1",
      inlineObjectId: "io1",
      text: "content",
    };
    assert.deepStrictEqual(deepStrip(obj), { text: "content" });
  });

  it("strips contentUri", () => {
    const obj = { contentUri: "https://lh3.google.com/...", alt: "image" };
    assert.deepStrictEqual(deepStrip(obj), { alt: "image" });
  });

  it("strips default header/footer IDs", () => {
    const obj = { defaultHeaderId: "h1", defaultFooterId: "f1", title: "Doc" };
    assert.deepStrictEqual(deepStrip(obj), { title: "Doc" });
  });

  it("recursively strips nested objects", () => {
    const obj = {
      outer: {
        inner: { startIndex: 0, text: "nested" },
      },
    };
    assert.deepStrictEqual(deepStrip(obj), { outer: { inner: { text: "nested" } } });
  });

  it("recursively strips arrays", () => {
    const arr = [
      { startIndex: 0, text: "a" },
      { startIndex: 5, text: "b" },
    ];
    assert.deepStrictEqual(deepStrip(arr), [{ text: "a" }, { text: "b" }]);
  });
});

describe("extractComparableContent", () => {
  it("returns empty tabs array for doc with no tabs", () => {
    const doc = {};
    const result = extractComparableContent(doc) as { tabs: unknown[] };
    assert.deepStrictEqual(result.tabs, []);
  });

  it("extracts tab title and index", () => {
    const doc = {
      tabs: [{ tabProperties: { title: "Tab 1", index: 0 }, documentTab: {} }],
    };
    const result = extractComparableContent(doc) as { tabs: { title: string; index: number }[] };
    assert.strictEqual(result.tabs[0].title, "Tab 1");
    assert.strictEqual(result.tabs[0].index, 0);
  });

  it("normalizes lists by stripping kix IDs", () => {
    const doc = {
      tabs: [
        {
          documentTab: {
            lists: {
              "kix.abc123": { listProperties: { nestingLevels: [{}] } },
            },
          },
        },
      ],
    };
    const result = extractComparableContent(doc) as { tabs: { lists: unknown[] }[] };
    // Lists should be normalized to an array (not keyed by kix ID)
    assert.strictEqual(Array.isArray(result.tabs[0].lists), true);
  });

  it("extracts body content with stripped indices", () => {
    const doc = {
      tabs: [
        {
          documentTab: {
            body: {
              content: [{ startIndex: 0, endIndex: 10, paragraph: { text: "hello" } }],
            },
          },
        },
      ],
    };
    const result = extractComparableContent(doc) as { tabs: { content: unknown[] }[] };
    // Content should have startIndex/endIndex stripped
    assert.deepStrictEqual(result.tabs[0].content, [{ paragraph: { text: "hello" } }]);
  });

  it("includes headers and footers when present", () => {
    const doc = {
      tabs: [
        {
          documentTab: {
            headers: { "kix.h1": { content: [{ text: "Header" }] } },
            footers: { "kix.f1": { content: [{ text: "Footer" }] } },
          },
        },
      ],
    };
    const result = extractComparableContent(doc) as { tabs: { headers: unknown[]; footers: unknown[] }[] };
    assert.strictEqual(result.tabs[0].headers?.length, 1);
    assert.strictEqual(result.tabs[0].footers?.length, 1);
  });

  it("omits headers and footers when empty", () => {
    const doc = {
      tabs: [{ documentTab: {} }],
    };
    const result = extractComparableContent(doc) as { tabs: { headers?: unknown; footers?: unknown }[] };
    assert.strictEqual(result.tabs[0].headers, undefined);
    assert.strictEqual(result.tabs[0].footers, undefined);
  });
});

describe("deepEqual", () => {
  it("returns empty array for identical primitives", () => {
    assert.deepStrictEqual(deepEqual(42, 42), []);
    assert.deepStrictEqual(deepEqual("hello", "hello"), []);
    assert.deepStrictEqual(deepEqual(true, true), []);
  });

  it("detects type mismatch", () => {
    const diffs = deepEqual(42, "42");
    assert.strictEqual(diffs.length, 1);
    assert.ok(diffs[0].includes("type mismatch"));
  });

  it("detects null vs non-null", () => {
    const diffs = deepEqual(null, { a: 1 });
    assert.strictEqual(diffs.length, 1);
  });

  it("detects array length mismatch", () => {
    const diffs = deepEqual([1, 2], [1, 2, 3]);
    assert.ok(diffs.some((d) => d.includes("array length")));
  });

  it("compares array elements", () => {
    const diffs = deepEqual([1, 2, 3], [1, 5, 3]);
    assert.ok(diffs.some((d) => d.includes("[1]")));
  });

  it("detects missing key in first object", () => {
    const diffs = deepEqual({ a: 1 }, { a: 1, b: 2 });
    assert.ok(diffs.some((d) => d.includes(".b") && d.includes("missing in doc A")));
  });

  it("detects missing key in second object", () => {
    const diffs = deepEqual({ a: 1, b: 2 }, { a: 1 });
    assert.ok(diffs.some((d) => d.includes(".b") && d.includes("missing in doc B")));
  });

  it("recursively compares nested objects", () => {
    const a = { outer: { inner: { value: 1 } } };
    const b = { outer: { inner: { value: 2 } } };
    const diffs = deepEqual(a, b);
    assert.ok(diffs.some((d) => d.includes(".outer.inner.value")));
  });

  it("reports path correctly for nested differences", () => {
    const a = { items: [{ name: "a" }] };
    const b = { items: [{ name: "b" }] };
    const diffs = deepEqual(a, b);
    assert.ok(diffs.some((d) => d.includes(".items[0].name")));
  });

  it("returns empty array for identical complex objects", () => {
    const obj = { a: 1, b: [2, 3], c: { d: "e" } };
    assert.deepStrictEqual(deepEqual(obj, obj), []);
  });
});

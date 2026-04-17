import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildAnchorByIndex,
  buildAnchorTargets,
  remapPendingLinks,
  buildAnchorLinkRequests,
} from "./anchor-links.ts";
import type { AnchorLocation, PendingAnchorLink } from "../dag/ir/document-registry.ts";

describe("buildAnchorByIndex", () => {
  it("returns empty map for empty anchors", () => {
    const result = buildAnchorByIndex(new Map(), {});
    assert.strictEqual(result.size, 0);
  });

  it("adds origin 1 for body segments (segmentId undefined)", () => {
    const anchors = new Map<string, AnchorLocation>([
      ["intro", { index: 5 }],
    ]);
    const result = buildAnchorByIndex(anchors, {});
    assert.strictEqual(result.has(6), true); // 5 + 1 origin
    assert.strictEqual(result.get(6)?.anchorName, "intro");
  });

  it("adds origin 0 for header/footer segments", () => {
    const anchors = new Map<string, AnchorLocation>([
      ["header-anchor", { index: 3, segmentId: "header-1" }],
    ]);
    const result = buildAnchorByIndex(anchors, {});
    assert.strictEqual(result.has(3), true); // 3 + 0 origin
    assert.strictEqual(result.get(3)?.anchorName, "header-anchor");
  });

  it("maps placeholder tabIds to real tabIds", () => {
    const anchors = new Map<string, AnchorLocation>([
      ["section", { index: 10, tabId: "tab-1" }],
    ]);
    const tabIdMap = { "tab-1": "real-tab-id" };
    const result = buildAnchorByIndex(anchors, tabIdMap);
    assert.strictEqual(result.get(11)?.tabId, "real-tab-id");
  });
});

describe("buildAnchorTargets", () => {
  it("returns empty map for empty tabs", () => {
    const result = buildAnchorTargets([], new Map());
    assert.strictEqual(result.size, 0);
  });

  it("finds heading at matching index", () => {
    const tabs = [
      {
        tabProperties: { tabId: "tab-0" },
        documentTab: {
          body: {
            content: [
              {
                startIndex: 5,
                paragraph: { paragraphStyle: { headingId: "h.abc123" } },
              },
            ],
          },
        },
      },
    ];
    const anchorByIndex = new Map([[5, { anchorName: "my-anchor" }]]);
    const result = buildAnchorTargets(tabs, anchorByIndex);
    assert.strictEqual(result.has("my-anchor"), true);
    assert.strictEqual(result.get("my-anchor")?.headingId, "h.abc123");
    assert.strictEqual(result.get("my-anchor")?.tabId, "tab-0");
  });

  it("ignores paragraphs without headingId", () => {
    const tabs = [
      {
        documentTab: {
          body: {
            content: [
              { startIndex: 5, paragraph: { paragraphStyle: {} } },
            ],
          },
        },
      },
    ];
    const anchorByIndex = new Map([[5, { anchorName: "my-anchor" }]]);
    const result = buildAnchorTargets(tabs, anchorByIndex);
    assert.strictEqual(result.size, 0);
  });

  it("ignores elements without paragraph", () => {
    const tabs = [
      {
        documentTab: {
          body: {
            content: [{ startIndex: 5, table: {} }],
          },
        },
      },
    ];
    const anchorByIndex = new Map([[5, { anchorName: "my-anchor" }]]);
    const result = buildAnchorTargets(tabs, anchorByIndex);
    assert.strictEqual(result.size, 0);
  });
});

describe("remapPendingLinks", () => {
  it("returns empty array for empty input", () => {
    const result = remapPendingLinks([], {});
    assert.deepStrictEqual(result, []);
  });

  it("rebases indices by adding 1 (body origin)", () => {
    const links: PendingAnchorLink[] = [
      { range: { startIndex: 10, endIndex: 15 }, anchorName: "link1" },
    ];
    const result = remapPendingLinks(links, {});
    assert.strictEqual(result[0].range.startIndex, 11);
    assert.strictEqual(result[0].range.endIndex, 16);
  });

  it("maps placeholder tabIds to real tabIds", () => {
    const links: PendingAnchorLink[] = [
      { range: { startIndex: 0, endIndex: 5 }, tabId: "tab-2", anchorName: "link" },
    ];
    const tabIdMap = { "tab-2": "real-tab-2" };
    const result = remapPendingLinks(links, tabIdMap);
    assert.strictEqual(result[0].tabId, "real-tab-2");
  });

  it("preserves undefined tabId", () => {
    const links: PendingAnchorLink[] = [
      { range: { startIndex: 0, endIndex: 5 }, anchorName: "link" },
    ];
    const result = remapPendingLinks(links, {});
    assert.strictEqual(result[0].tabId, undefined);
  });
});

describe("buildAnchorLinkRequests", () => {
  it("returns empty for no links", () => {
    const result = buildAnchorLinkRequests([], new Map());
    assert.deepStrictEqual(result.requests, []);
    assert.deepStrictEqual(result.unresolved, []);
  });

  it("builds updateTextStyle request for resolved link", () => {
    const links = [
      { range: { startIndex: 10, endIndex: 20 }, anchorName: "section1" },
    ];
    const targets = new Map([["section1", { headingId: "h.xyz" }]]);
    const result = buildAnchorLinkRequests(links, targets);

    assert.strictEqual(result.requests.length, 1);
    assert.strictEqual(result.unresolved.length, 0);

    const req = result.requests[0] as {
      updateTextStyle: {
        range: { startIndex: number; endIndex: number };
        textStyle: { link: { heading: { id: string } } };
        fields: string;
      };
    };
    assert.strictEqual(req.updateTextStyle.range.startIndex, 10);
    assert.strictEqual(req.updateTextStyle.range.endIndex, 20);
    assert.strictEqual(req.updateTextStyle.textStyle.link.heading.id, "h.xyz");
    assert.strictEqual(req.updateTextStyle.fields, "link");
  });

  it("includes tabId in range when present", () => {
    const links = [
      { range: { startIndex: 5, endIndex: 10 }, tabId: "tab-1", anchorName: "x" },
    ];
    const targets = new Map([["x", { headingId: "h.1" }]]);
    const result = buildAnchorLinkRequests(links, targets);

    const req = result.requests[0] as {
      updateTextStyle: { range: { tabId?: string } };
    };
    assert.strictEqual(req.updateTextStyle.range.tabId, "tab-1");
  });

  it("includes tabId in link target when present", () => {
    const links = [{ range: { startIndex: 0, endIndex: 1 }, anchorName: "y" }];
    const targets = new Map([["y", { headingId: "h.2", tabId: "tab-2" }]]);
    const result = buildAnchorLinkRequests(links, targets);

    const req = result.requests[0] as {
      updateTextStyle: { textStyle: { link: { heading: { tabId?: string } } } };
    };
    assert.strictEqual(req.updateTextStyle.textStyle.link.heading.tabId, "tab-2");
  });

  it("reports unresolved anchor names", () => {
    const links = [
      { range: { startIndex: 0, endIndex: 5 }, anchorName: "missing" },
    ];
    const result = buildAnchorLinkRequests(links, new Map());

    assert.strictEqual(result.requests.length, 0);
    assert.deepStrictEqual(result.unresolved, ["missing"]);
  });

  it("handles mix of resolved and unresolved", () => {
    const links = [
      { range: { startIndex: 0, endIndex: 1 }, anchorName: "found" },
      { range: { startIndex: 2, endIndex: 3 }, anchorName: "missing" },
    ];
    const targets = new Map([["found", { headingId: "h.found" }]]);
    const result = buildAnchorLinkRequests(links, targets);

    assert.strictEqual(result.requests.length, 1);
    assert.deepStrictEqual(result.unresolved, ["missing"]);
  });
});

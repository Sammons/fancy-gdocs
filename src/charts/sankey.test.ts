/**
 * Tests for sankey diagram SVG generator
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { generateSankey } from "./sankey.ts";
import type { SankeyChartData } from "./types.ts";

describe("sankey diagram generator", () => {
  describe("simple 2-column sankey", () => {
    it("generates SVG for sources to targets", () => {
      const data: SankeyChartData = {
        title: "Traffic Flow",
        nodes: [
          { id: "organic", label: "Organic" },
          { id: "paid", label: "Paid" },
          { id: "landing", label: "Landing Page" },
        ],
        links: [
          { source: "organic", target: "landing", value: 100 },
          { source: "paid", target: "landing", value: 50 },
        ],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes("<svg"), "should generate SVG element");
      assert.ok(svg.includes("Traffic Flow"), "should include title");
      assert.ok(svg.includes('class="chart-nodes"'), "should have nodes group");
      assert.ok(svg.includes('class="chart-links"'), "should have links group");
      assert.ok(svg.includes("<rect"), "should include rect elements for nodes");
      assert.ok(svg.includes("<path"), "should include path elements for links");
    });

    it("renders correct number of nodes and links", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        links: [
          { source: "a", target: "c", value: 100 },
          { source: "b", target: "c", value: 50 },
        ],
      };

      const svg = generateSankey(data);

      // 3 nodes = 3 rects
      const rectMatches = svg.match(/<rect/g) || [];
      assert.strictEqual(rectMatches.length, 3, "should have 3 node rectangles");

      // 2 links = 2 paths
      const pathMatches = svg.match(/<path/g) || [];
      assert.strictEqual(pathMatches.length, 2, "should have 2 link paths");
    });

    it("assigns colors when not specified", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes("#4285F4"), "should include first palette color");
      assert.ok(svg.includes("#EA4335"), "should include second palette color");
    });

    it("uses specified colors", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A", color: "#FF0000" },
          { id: "b", label: "B", color: "#00FF00" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes('fill="#FF0000"'), "should use specified red color");
      assert.ok(svg.includes('fill="#00FF00"'), "should use specified green color");
    });
  });

  describe("multi-column sankey (A -> B -> C)", () => {
    it("generates multi-column layout", () => {
      const data: SankeyChartData = {
        title: "Funnel",
        nodes: [
          { id: "visitors", label: "Visitors" },
          { id: "signups", label: "Sign Ups" },
          { id: "purchases", label: "Purchases" },
        ],
        links: [
          { source: "visitors", target: "signups", value: 1000 },
          { source: "signups", target: "purchases", value: 200 },
        ],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes("Visitors"), "should include first node label");
      assert.ok(svg.includes("Sign Ups"), "should include second node label");
      assert.ok(svg.includes("Purchases"), "should include third node label");
    });

    it("handles complex flow with branches", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "source", label: "Source" },
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "sink", label: "Sink" },
        ],
        links: [
          { source: "source", target: "a", value: 60 },
          { source: "source", target: "b", value: 40 },
          { source: "a", target: "sink", value: 60 },
          { source: "b", target: "sink", value: 40 },
        ],
      };

      const svg = generateSankey(data);

      // 4 nodes, 4 links
      const rectMatches = svg.match(/<rect/g) || [];
      const pathMatches = svg.match(/<path/g) || [];
      assert.strictEqual(rectMatches.length, 4, "should have 4 node rectangles");
      assert.strictEqual(pathMatches.length, 4, "should have 4 link paths");
    });
  });

  describe("link widths proportional to values", () => {
    it("creates wider paths for larger values", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "big", label: "Big Source" },
          { id: "small", label: "Small Source" },
          { id: "target", label: "Target" },
        ],
        links: [
          { source: "big", target: "target", value: 1000 },
          { source: "small", target: "target", value: 100 },
        ],
      };

      const svg = generateSankey(data);

      // Both links should be present
      assert.ok(svg.includes("<path"), "should have link paths");
      const pathMatches = svg.match(/<path/g) || [];
      assert.strictEqual(pathMatches.length, 2, "should have 2 links");
    });

    it("handles equal value links", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        links: [
          { source: "a", target: "c", value: 50 },
          { source: "b", target: "c", value: 50 },
        ],
      };

      const svg = generateSankey(data);

      // Should generate valid SVG
      assert.ok(svg.includes("<svg"), "should generate valid SVG");
    });
  });

  describe("node positioning", () => {
    it("positions source nodes on the left", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "source1", label: "Source 1" },
          { id: "source2", label: "Source 2" },
          { id: "target", label: "Target" },
        ],
        links: [
          { source: "source1", target: "target", value: 100 },
          { source: "source2", target: "target", value: 100 },
        ],
      };

      const svg = generateSankey(data);

      // Source labels should have text-anchor="end" (left column)
      // Target label should have text-anchor="start" (right column)
      assert.ok(svg.includes('text-anchor="end"'), "should have left-anchored labels");
      assert.ok(svg.includes('text-anchor="start"'), "should have right-anchored labels");
    });

    it("renders node labels", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "Alpha Node" },
          { id: "b", label: "Beta Node" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes("Alpha Node"), "should include first node label");
      assert.ok(svg.includes("Beta Node"), "should include second node label");
    });
  });

  describe("edge cases", () => {
    it("handles single node", () => {
      const data: SankeyChartData = {
        nodes: [{ id: "lonely", label: "Lonely Node" }],
        links: [],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes("<svg"), "should generate valid SVG");
      assert.ok(svg.includes("Lonely Node"), "should include node label");
      assert.ok((svg.match(/<rect/g) || []).length === 1, "should have 1 node");
    });

    it("handles empty data", () => {
      const data: SankeyChartData = {
        title: "Empty",
        nodes: [],
        links: [],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes("<svg"), "should generate valid SVG");
      assert.ok(svg.includes("No data"), "should show no data message");
    });

    it("handles circular reference gracefully", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        links: [
          { source: "a", target: "b", value: 100 },
          { source: "b", target: "c", value: 100 },
          { source: "c", target: "a", value: 50 }, // circular
        ],
      };

      const svg = generateSankey(data);

      // Should generate valid SVG without infinite loop
      assert.ok(svg.includes("<svg"), "should generate valid SVG");
      assert.ok(svg.includes("A"), "should include node A");
      assert.ok(svg.includes("B"), "should include node B");
      assert.ok(svg.includes("C"), "should include node C");
    });

    it("handles links referencing non-existent nodes", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [
          { source: "a", target: "b", value: 100 },
          { source: "missing", target: "b", value: 50 }, // invalid source
        ],
      };

      const svg = generateSankey(data);

      // Should generate valid SVG, ignoring invalid link
      assert.ok(svg.includes("<svg"), "should generate valid SVG");
    });

    it("handles zero-value links", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [{ source: "a", target: "b", value: 0 }],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes("<svg"), "should generate valid SVG");
    });
  });

  describe("accessibility", () => {
    it("includes role and aria-label", () => {
      const data: SankeyChartData = {
        title: "Accessible Sankey",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes('role="img"'), "should have role=img");
      assert.ok(svg.includes('aria-label="Accessible Sankey"'), "should have aria-label");
    });

    it("includes title element", () => {
      const data: SankeyChartData = {
        title: "Chart Title",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes("<title>Chart Title</title>"), "should have title element");
    });
  });

  describe("link rendering", () => {
    it("renders links with 0.5 opacity", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes('opacity="0.5"'), "should have 0.5 opacity on links");
    });

    it("renders bezier curve paths", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data);

      // Bezier curves use C command
      assert.ok(svg.includes(" C "), "should have cubic bezier curve in path");
    });
  });

  describe("node rendering", () => {
    it("renders nodes with 20px width", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes('width="20"'), "should have 20px node width");
    });
  });

  describe("custom dimensions", () => {
    it("respects custom width and height", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data, { width: 1000, height: 600 });

      assert.ok(svg.includes('width="1000"'), "should use custom width");
      assert.ok(svg.includes('height="600"'), "should use custom height");
    });

    it("uses default dimensions when not specified", () => {
      const data: SankeyChartData = {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        links: [{ source: "a", target: "b", value: 100 }],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes('width="800"'), "should use default width of 800");
      assert.ok(svg.includes('height="500"'), "should use default height of 500");
    });
  });

  describe("real-world example", () => {
    it("handles traffic sources to conversions flow", () => {
      const data: SankeyChartData = {
        title: "Traffic Sources to Conversions",
        nodes: [
          { id: "organic", label: "Organic Search" },
          { id: "paid", label: "Paid Ads" },
          { id: "social", label: "Social Media" },
          { id: "landing", label: "Landing Page" },
          { id: "signup", label: "Sign Up" },
          { id: "purchase", label: "Purchase" },
        ],
        links: [
          { source: "organic", target: "landing", value: 5000 },
          { source: "paid", target: "landing", value: 3000 },
          { source: "social", target: "landing", value: 2000 },
          { source: "landing", target: "signup", value: 4000 },
          { source: "landing", target: "purchase", value: 1500 },
          { source: "signup", target: "purchase", value: 2500 },
        ],
      };

      const svg = generateSankey(data);

      assert.ok(svg.includes("<svg"), "should generate valid SVG");
      assert.ok(svg.includes("Traffic Sources to Conversions"), "should include title");

      // 6 nodes
      const rectMatches = svg.match(/<rect/g) || [];
      assert.strictEqual(rectMatches.length, 6, "should have 6 node rectangles");

      // 6 links
      const pathMatches = svg.match(/<path/g) || [];
      assert.strictEqual(pathMatches.length, 6, "should have 6 link paths");

      // All labels present
      assert.ok(svg.includes("Organic Search"), "should include Organic Search");
      assert.ok(svg.includes("Paid Ads"), "should include Paid Ads");
      assert.ok(svg.includes("Social Media"), "should include Social Media");
      assert.ok(svg.includes("Landing Page"), "should include Landing Page");
      assert.ok(svg.includes("Sign Up"), "should include Sign Up");
      assert.ok(svg.includes("Purchase"), "should include Purchase");
    });
  });
});

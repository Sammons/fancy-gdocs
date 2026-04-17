/**
 * Tests for bar chart SVG generator
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { generateBar, calculateNiceScale } from "./bar.ts";
import type { BarChartData, GroupedBarChartData } from "./types.ts";

describe("bar chart generator", () => {
  describe("simple bar chart", () => {
    it("generates SVG for simple data", () => {
      const data: BarChartData = {
        title: "Monthly Sales",
        xAxis: "Month",
        yAxis: "Revenue ($K)",
        data: [
          { label: "Jan", value: 120 },
          { label: "Feb", value: 150 },
          { label: "Mar", value: 180 },
        ],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes("<svg"), "should generate SVG element");
      assert.ok(svg.includes("Monthly Sales"), "should include title");
      assert.ok(svg.includes("Jan"), "should include category labels");
      assert.ok(svg.includes("Feb"), "should include category labels");
      assert.ok(svg.includes("Mar"), "should include category labels");
      assert.ok(svg.includes("<rect"), "should include bar rectangles");
      assert.ok(svg.includes('class="chart-bars"'), "should have chart-bars group");
      assert.ok(svg.includes('class="chart-grid"'), "should have grid lines");
    });

    it("assigns colors when not specified", () => {
      const data: BarChartData = {
        data: [
          { label: "A", value: 10 },
          { label: "B", value: 20 },
        ],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes('fill="#4285F4"'), "should assign palette color");
    });

    it("uses specified colors", () => {
      const data: BarChartData = {
        data: [
          { label: "A", value: 10, color: "#FF0000" },
          { label: "B", value: 20, color: "#00FF00" },
        ],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes('fill="#FF0000"'), "should use specified red");
      assert.ok(svg.includes('fill="#00FF00"'), "should use specified green");
    });

    it("includes axis labels when provided", () => {
      const data: BarChartData = {
        xAxis: "Categories",
        yAxis: "Values",
        data: [{ label: "A", value: 10 }],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes("Categories"), "should include x-axis label");
      assert.ok(svg.includes("Values"), "should include y-axis label");
    });

    it("respects custom dimensions", () => {
      const data: BarChartData = {
        data: [{ label: "A", value: 10 }],
      };

      const svg = generateBar(data, { width: 800, height: 500 });

      assert.ok(svg.includes('width="800"'), "should use custom width");
      assert.ok(svg.includes('height="500"'), "should use custom height");
    });
  });

  describe("grouped bar chart", () => {
    it("generates grouped bars for multiple series", () => {
      const data: GroupedBarChartData = {
        title: "Quarterly Revenue",
        categories: ["Q1", "Q2", "Q3", "Q4"],
        series: [
          { name: "2024", values: [10, 12, 15, 18] },
          { name: "2025", values: [12, 14, 17, 22] },
        ],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes("Quarterly Revenue"), "should include title");
      assert.ok(svg.includes("Q1"), "should include Q1 category");
      assert.ok(svg.includes("Q4"), "should include Q4 category");
      assert.ok(svg.includes('class="chart-legend"'), "should include legend");
      assert.ok(svg.includes("2024"), "should include series name in legend");
      assert.ok(svg.includes("2025"), "should include series name in legend");
    });

    it("assigns different colors to each series", () => {
      const data: GroupedBarChartData = {
        categories: ["A", "B"],
        series: [
          { name: "Series 1", values: [10, 20] },
          { name: "Series 2", values: [15, 25] },
        ],
      };

      const svg = generateBar(data);

      // First series gets first palette color, second gets second
      assert.ok(svg.includes("#4285F4"), "should include first palette color");
      assert.ok(svg.includes("#EA4335"), "should include second palette color");
    });
  });

  describe("stacked bar chart", () => {
    it("generates stacked bars when stacked option is true", () => {
      const data: GroupedBarChartData = {
        title: "Stacked Revenue",
        categories: ["Q1", "Q2"],
        series: [
          { name: "Product A", values: [10, 15] },
          { name: "Product B", values: [5, 8] },
        ],
      };

      const svg = generateBar(data, { stacked: true });

      assert.ok(svg.includes("Stacked Revenue"), "should include title");
      assert.ok(svg.includes('class="chart-bars"'), "should have bars");
      assert.ok(svg.includes('class="chart-legend"'), "should have legend");
      // Stacked bars should still have rect elements
      assert.ok((svg.match(/<rect/g) || []).length >= 4, "should have at least 4 rects");
    });
  });

  describe("horizontal bar chart", () => {
    it("generates horizontal bars when horizontal option is true", () => {
      const data: BarChartData = {
        title: "Horizontal Sales",
        data: [
          { label: "Product A", value: 100 },
          { label: "Product B", value: 150 },
          { label: "Product C", value: 80 },
        ],
      };

      const svg = generateBar(data, { horizontal: true });

      assert.ok(svg.includes("Horizontal Sales"), "should include title");
      assert.ok(svg.includes("Product A"), "should include category labels");
      assert.ok(svg.includes("<rect"), "should have bar rectangles");
    });

    it("generates horizontal stacked bars", () => {
      const data: GroupedBarChartData = {
        categories: ["A", "B"],
        series: [
          { name: "S1", values: [10, 20] },
          { name: "S2", values: [5, 10] },
        ],
      };

      const svg = generateBar(data, { horizontal: true, stacked: true });

      assert.ok(svg.includes("<rect"), "should have bar rectangles");
      assert.ok(svg.includes("S1"), "should include series names");
    });
  });

  describe("axis scaling", () => {
    it("calculates nice scale values", () => {
      const scale = calculateNiceScale(0, 95);

      assert.strictEqual(scale.min, 0, "min should be 0");
      assert.ok(scale.max >= 95, "max should be at least 95");
      assert.ok(scale.max % 10 === 0 || scale.max % 5 === 0, "max should be a nice number");
      assert.ok(scale.ticks.length >= 4, "should have multiple ticks");
      assert.ok(scale.ticks[0] === 0, "first tick should be 0");
    });

    it("handles small value ranges", () => {
      const scale = calculateNiceScale(0, 5);

      assert.strictEqual(scale.min, 0, "min should be 0");
      assert.ok(scale.max >= 5, "max should be at least 5");
      assert.ok(scale.ticks.length >= 2, "should have at least 2 ticks");
    });

    it("handles large value ranges", () => {
      const scale = calculateNiceScale(0, 10000);

      assert.strictEqual(scale.min, 0, "min should be 0");
      assert.ok(scale.max >= 10000, "max should be at least 10000");
      assert.ok(scale.step >= 1000, "step should be at least 1000");
    });

    it("handles zero range", () => {
      const scale = calculateNiceScale(50, 50);

      assert.ok(scale.max > scale.min, "should create valid range");
      assert.ok(scale.ticks.length >= 2, "should have ticks");
    });

    it("formats large numbers with K suffix in chart", () => {
      const data: BarChartData = {
        data: [
          { label: "A", value: 1500 },
          { label: "B", value: 2500 },
        ],
      };

      const svg = generateBar(data);

      // Should format 1K, 2K, etc. somewhere in axis
      assert.ok(
        svg.includes("K") || svg.includes("1500") || svg.includes("2500"),
        "should format values"
      );
    });
  });

  describe("title and legend", () => {
    it("renders title when provided", () => {
      const data: BarChartData = {
        title: "My Chart Title",
        data: [{ label: "A", value: 10 }],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes("My Chart Title"), "should include title text");
      assert.ok(svg.includes('class="chart-title"'), "should have title group");
    });

    it("omits title group when no title", () => {
      const data: BarChartData = {
        data: [{ label: "A", value: 10 }],
      };

      const svg = generateBar(data);

      assert.ok(!svg.includes('class="chart-title"'), "should not have title group");
    });

    it("renders legend only for grouped data", () => {
      const simpleData: BarChartData = {
        data: [{ label: "A", value: 10 }],
      };

      const groupedData: GroupedBarChartData = {
        categories: ["A"],
        series: [{ name: "Series 1", values: [10] }],
      };

      const simpleSvg = generateBar(simpleData);
      const groupedSvg = generateBar(groupedData);

      assert.ok(!simpleSvg.includes('class="chart-legend"'), "simple should not have legend");
      assert.ok(groupedSvg.includes('class="chart-legend"'), "grouped should have legend");
    });
  });

  describe("accessibility", () => {
    it("includes role and aria-label", () => {
      const data: BarChartData = {
        title: "Accessible Chart",
        data: [{ label: "A", value: 10 }],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes('role="img"'), "should have role=img");
      assert.ok(svg.includes('aria-label="Accessible Chart"'), "should have aria-label");
    });

    it("includes title element", () => {
      const data: BarChartData = {
        title: "Chart Title",
        data: [{ label: "A", value: 10 }],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes("<title>Chart Title</title>"), "should have title element");
    });
  });

  describe("edge cases", () => {
    it("handles single bar", () => {
      const data: BarChartData = {
        data: [{ label: "Only", value: 100 }],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes("<rect"), "should generate bar");
      assert.ok(svg.includes("Only"), "should include label");
    });

    it("handles many categories", () => {
      const data: BarChartData = {
        data: Array.from({ length: 12 }, (_, i) => ({
          label: `Month ${i + 1}`,
          value: Math.random() * 100,
        })),
      };

      const svg = generateBar(data);

      assert.ok(svg.includes("Month 1"), "should include first month");
      assert.ok(svg.includes("Month 12"), "should include last month");
    });

    it("handles zero values", () => {
      const data: BarChartData = {
        data: [
          { label: "A", value: 0 },
          { label: "B", value: 50 },
          { label: "C", value: 0 },
        ],
      };

      const svg = generateBar(data);

      assert.ok(svg.includes("<svg"), "should generate valid SVG");
      assert.ok(svg.includes("A"), "should include label for zero value");
    });
  });
});

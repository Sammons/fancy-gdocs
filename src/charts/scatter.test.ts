/**
 * Tests for scatter plot SVG generator
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { generateScatter, calculateNiceScale, linearRegression } from "./scatter.ts";
import type { ScatterChartData } from "./types.ts";

describe("scatter plot generator", () => {
  describe("single series scatter", () => {
    it("generates SVG for single series data", () => {
      const data: ScatterChartData = {
        title: "Price vs Performance",
        xAxis: "Price ($)",
        yAxis: "Performance Score",
        series: [
          {
            name: "Products",
            points: [
              { x: 100, y: 75 },
              { x: 150, y: 82 },
              { x: 200, y: 88 },
            ],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes("<svg"), "should generate SVG element");
      assert.ok(svg.includes("Price vs Performance"), "should include title");
      assert.ok(svg.includes('class="chart-points"'), "should have points group");
      assert.ok(svg.includes("<circle"), "should include circle elements");
      assert.ok((svg.match(/<circle/g) || []).length >= 3, "should have 3 points");
    });

    it("assigns colors when not specified", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Series A",
            points: [{ x: 10, y: 20 }],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes('fill="#4285F4"'), "should assign first palette color");
    });

    it("uses specified colors", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Red Series",
            points: [{ x: 10, y: 20 }],
            color: "#FF0000",
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes('fill="#FF0000"'), "should use specified color");
    });

    it("does not render legend for single series", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Only Series",
            points: [{ x: 10, y: 20 }],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(!svg.includes('class="chart-legend"'), "should not have legend");
    });
  });

  describe("multiple series", () => {
    it("generates scatter with multiple series", () => {
      const data: ScatterChartData = {
        title: "Product Comparison",
        series: [
          {
            name: "Product A",
            points: [
              { x: 100, y: 75 },
              { x: 150, y: 82 },
            ],
          },
          {
            name: "Product B",
            points: [
              { x: 120, y: 70 },
              { x: 180, y: 85 },
            ],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes("Product Comparison"), "should include title");
      assert.ok(svg.includes('class="chart-legend"'), "should include legend");
      assert.ok(svg.includes("Product A"), "should include series A in legend");
      assert.ok(svg.includes("Product B"), "should include series B in legend");
      // 4 points total
      assert.ok((svg.match(/<circle/g) || []).length >= 4, "should have at least 4 circles");
    });

    it("assigns different colors to each series", () => {
      const data: ScatterChartData = {
        series: [
          { name: "S1", points: [{ x: 10, y: 10 }] },
          { name: "S2", points: [{ x: 20, y: 20 }] },
          { name: "S3", points: [{ x: 30, y: 30 }] },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes("#4285F4"), "should include first palette color");
      assert.ok(svg.includes("#EA4335"), "should include second palette color");
      assert.ok(svg.includes("#FBBC05"), "should include third palette color");
    });
  });

  describe("axis scaling and labels", () => {
    it("includes axis labels when provided", () => {
      const data: ScatterChartData = {
        xAxis: "X Label",
        yAxis: "Y Label",
        series: [{ name: "S", points: [{ x: 10, y: 20 }] }],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes("X Label"), "should include x-axis label");
      assert.ok(svg.includes("Y Label"), "should include y-axis label");
    });

    it("calculates nice scale with 10% padding", () => {
      const scale = calculateNiceScale(100, 200);

      // 10% padding on range of 100 means min ~90, max ~210
      assert.ok(scale.min < 100, "min should be less than data min");
      assert.ok(scale.max > 200, "max should be greater than data max");
      assert.ok(scale.ticks.length >= 3, "should have multiple ticks");
    });

    it("renders grid lines on both axes", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "S",
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes('class="chart-grid"'), "should have grid group");
      // Grid lines are rendered as <line> elements
      assert.ok((svg.match(/<line/g) || []).length >= 6, "should have multiple grid lines");
    });

    it("respects custom dimensions", () => {
      const data: ScatterChartData = {
        series: [{ name: "S", points: [{ x: 10, y: 20 }] }],
      };

      const svg = generateScatter(data, { width: 800, height: 500 });

      assert.ok(svg.includes('width="800"'), "should use custom width");
      assert.ok(svg.includes('height="500"'), "should use custom height");
    });
  });

  describe("trend line calculation", () => {
    it("calculates linear regression correctly", () => {
      const points = [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ];

      const result = linearRegression(points);

      assert.ok(result !== null, "should return regression result");
      assert.strictEqual(result!.m, 2, "slope should be 2");
      assert.strictEqual(result!.b, 0, "intercept should be 0");
    });

    it("renders trend line when option is enabled", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Linear",
            points: [
              { x: 1, y: 2 },
              { x: 2, y: 4 },
              { x: 3, y: 6 },
            ],
          },
        ],
      };

      const svg = generateScatter(data, { trendLine: true });

      assert.ok(svg.includes('class="chart-trend-lines"'), "should have trend lines group");
      assert.ok(svg.includes('stroke-dasharray="6,4"'), "should have dashed line");
      assert.ok(svg.includes('opacity="0.5"'), "should have 50% opacity");
    });

    it("does not render trend line by default", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "S",
            points: [
              { x: 1, y: 2 },
              { x: 2, y: 4 },
            ],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(!svg.includes('class="chart-trend-lines"'), "should not have trend lines");
    });

    it("renders trend line for each series", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "S1",
            points: [
              { x: 1, y: 2 },
              { x: 2, y: 4 },
            ],
          },
          {
            name: "S2",
            points: [
              { x: 1, y: 3 },
              { x: 2, y: 5 },
            ],
          },
        ],
      };

      const svg = generateScatter(data, { trendLine: true });

      // Each series should have a trend line
      const trendLineMatches = svg.match(/stroke-dasharray="6,4"/g) || [];
      assert.strictEqual(trendLineMatches.length, 2, "should have 2 trend lines");
    });
  });

  describe("edge cases", () => {
    it("handles single point", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Single",
            points: [{ x: 50, y: 50 }],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes("<circle"), "should generate point circle");
      assert.ok(svg.includes("<svg"), "should generate valid SVG");
    });

    it("handles single point with trend line disabled", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Single",
            points: [{ x: 50, y: 50 }],
          },
        ],
      };

      // linearRegression returns null for single point
      const result = linearRegression(data.series[0].points);
      assert.strictEqual(result, null, "should return null for single point");

      // Should still generate SVG without error
      const svg = generateScatter(data, { trendLine: true });
      assert.ok(svg.includes("<svg"), "should generate valid SVG");
      assert.ok(!svg.includes('class="chart-trend-lines"'), "should not have trend lines for single point");
    });

    it("handles collinear vertical points", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Vertical",
            points: [
              { x: 5, y: 10 },
              { x: 5, y: 20 },
              { x: 5, y: 30 },
            ],
          },
        ],
      };

      // Vertical line has undefined slope
      const result = linearRegression(data.series[0].points);
      assert.strictEqual(result, null, "should return null for vertical line");

      // Should still generate SVG without error
      const svg = generateScatter(data, { trendLine: true });
      assert.ok(svg.includes("<svg"), "should generate valid SVG");
    });

    it("handles collinear horizontal points", () => {
      const points = [
        { x: 1, y: 5 },
        { x: 2, y: 5 },
        { x: 3, y: 5 },
      ];

      const result = linearRegression(points);
      assert.ok(result !== null, "should return regression for horizontal line");
      assert.strictEqual(result!.m, 0, "slope should be 0");
      assert.strictEqual(result!.b, 5, "intercept should be 5");
    });

    it("handles empty series", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Empty",
            points: [],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes("<svg"), "should generate valid SVG");
    });

    it("handles negative values", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Negative",
            points: [
              { x: -50, y: -30 },
              { x: 0, y: 0 },
              { x: 50, y: 30 },
            ],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes("<svg"), "should generate valid SVG");
      assert.ok((svg.match(/<circle/g) || []).length >= 3, "should have 3 points");
    });

    it("handles very large values", () => {
      const data: ScatterChartData = {
        series: [
          {
            name: "Large",
            points: [
              { x: 1000000, y: 2000000 },
              { x: 2000000, y: 4000000 },
            ],
          },
        ],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes("<svg"), "should generate valid SVG");
      // Should format with M suffix
      assert.ok(svg.includes("M"), "should format large numbers with M suffix");
    });
  });

  describe("accessibility", () => {
    it("includes role and aria-label", () => {
      const data: ScatterChartData = {
        title: "Accessible Scatter",
        series: [{ name: "S", points: [{ x: 10, y: 20 }] }],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes('role="img"'), "should have role=img");
      assert.ok(svg.includes('aria-label="Accessible Scatter"'), "should have aria-label");
    });

    it("includes title element", () => {
      const data: ScatterChartData = {
        title: "Chart Title",
        series: [{ name: "S", points: [{ x: 10, y: 20 }] }],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes("<title>Chart Title</title>"), "should have title element");
    });
  });

  describe("point rendering", () => {
    it("renders points with white stroke", () => {
      const data: ScatterChartData = {
        series: [{ name: "S", points: [{ x: 10, y: 20 }] }],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes('stroke="#FFFFFF"'), "should have white stroke");
      assert.ok(svg.includes('stroke-width="1.5"'), "should have 1.5px stroke width");
    });

    it("renders points with 5px radius", () => {
      const data: ScatterChartData = {
        series: [{ name: "S", points: [{ x: 10, y: 20 }] }],
      };

      const svg = generateScatter(data);

      assert.ok(svg.includes('r="5"'), "should have 5px radius");
    });
  });
});

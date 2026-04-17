/**
 * Tests for pie chart SVG generation
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { generatePie } from "./pie.ts";
import { assignPieColors, PALETTE } from "./colors.ts";
import type { PieChartData } from "./types.ts";

describe("generatePie", () => {
  it("generates valid SVG structure", () => {
    const data: PieChartData = {
      data: [
        { label: "A", value: 50 },
        { label: "B", value: 50 },
      ],
    };

    const svg = generatePie(data);

    assert.ok(svg.startsWith("<svg"), "Should start with <svg tag");
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), "Should have SVG namespace");
    assert.ok(svg.includes('role="img"'), "Should have role=img for accessibility");
    assert.ok(svg.endsWith("</svg>"), "Should end with closing svg tag");
  });

  it("renders title when provided", () => {
    const data: PieChartData = {
      title: "Revenue by Region",
      data: [
        { label: "North", value: 100 },
        { label: "South", value: 50 },
      ],
    };

    const svg = generatePie(data);

    assert.ok(svg.includes("<title>Revenue by Region</title>"), "Should have title element");
    assert.ok(svg.includes('aria-label="Revenue by Region"'), "Should have aria-label");
    assert.ok(svg.includes(">Revenue by Region<"), "Should render title text");
  });

  it("generates correct number of slices", () => {
    const data: PieChartData = {
      data: [
        { label: "A", value: 25 },
        { label: "B", value: 25 },
        { label: "C", value: 25 },
        { label: "D", value: 25 },
      ],
    };

    const svg = generatePie(data);

    // Count path elements (each slice is a path)
    const pathCount = (svg.match(/<path /g) || []).length;
    assert.equal(pathCount, 4, "Should have 4 path elements for 4 slices");
  });

  it("uses provided colors when specified", () => {
    const data: PieChartData = {
      data: [
        { label: "Custom Red", value: 50, color: "#FF0000" },
        { label: "Custom Blue", value: 50, color: "#0000FF" },
      ],
    };

    const svg = generatePie(data);

    assert.ok(svg.includes('fill="#FF0000"'), "Should use custom red color");
    assert.ok(svg.includes('fill="#0000FF"'), "Should use custom blue color");
  });

  it("assigns palette colors when not specified", () => {
    const data: PieChartData = {
      data: [
        { label: "A", value: 33 },
        { label: "B", value: 33 },
        { label: "C", value: 34 },
      ],
    };

    const svg = generatePie(data);

    // Should use first three palette colors
    assert.ok(svg.includes(`fill="${PALETTE[0]}"`), "Should use first palette color");
    assert.ok(svg.includes(`fill="${PALETTE[1]}"`), "Should use second palette color");
    assert.ok(svg.includes(`fill="${PALETTE[2]}"`), "Should use third palette color");
  });

  it("respects custom dimensions", () => {
    const data: PieChartData = {
      data: [{ label: "A", value: 100 }],
    };

    const svg = generatePie(data, { width: 600, height: 500 });

    assert.ok(svg.includes('viewBox="0 0 600 500"'), "Should have correct viewBox");
    assert.ok(svg.includes('width="600"'), "Should have correct width");
    assert.ok(svg.includes('height="500"'), "Should have correct height");
  });

  it("handles empty data gracefully", () => {
    const data: PieChartData = {
      title: "Empty Chart",
      data: [],
    };

    const svg = generatePie(data);

    assert.ok(svg.includes("No data"), "Should show no data message");
  });

  it("handles zero total gracefully", () => {
    const data: PieChartData = {
      data: [
        { label: "Zero", value: 0 },
        { label: "Also Zero", value: 0 },
      ],
    };

    const svg = generatePie(data);

    assert.ok(svg.includes("No data"), "Should show no data message for zero total");
  });

  it("renders percentage labels", () => {
    const data: PieChartData = {
      data: [
        { label: "Half", value: 50 },
        { label: "Quarter", value: 25 },
        { label: "Quarter2", value: 25 },
      ],
    };

    const svg = generatePie(data);

    assert.ok(svg.includes("(50.0%)"), "Should show 50% for half");
    assert.ok(svg.includes("(25.0%)"), "Should show 25% for quarters");
  });

  it("renders legend with all items", () => {
    const data: PieChartData = {
      data: [
        { label: "Alpha", value: 60 },
        { label: "Beta", value: 40 },
      ],
    };

    const svg = generatePie(data);

    // Legend should contain text elements with labels (without percentages)
    assert.ok(svg.includes(">Alpha<"), "Legend should include Alpha label");
    assert.ok(svg.includes(">Beta<"), "Legend should include Beta label");
    assert.ok(svg.includes('class="chart-legend"'), "Should have legend group");
  });

  it("generates correct arc for large slice (>180 degrees)", () => {
    const data: PieChartData = {
      data: [
        { label: "Large", value: 75 },
        { label: "Small", value: 25 },
      ],
    };

    const svg = generatePie(data);

    // Large slice (75%) should have large arc flag = 1
    // The arc command format is: A rx ry rotation large-arc-flag sweep-flag x y
    // We're looking for "1 1" where first 1 is large-arc-flag
    const arcMatch = svg.match(/A \d+(\.\d+)? \d+(\.\d+)? 0 1 1/);
    assert.ok(arcMatch, "Large slice should use large arc flag (1)");
  });

  it("includes white stroke between slices", () => {
    const data: PieChartData = {
      data: [
        { label: "A", value: 50 },
        { label: "B", value: 50 },
      ],
    };

    const svg = generatePie(data);

    assert.ok(svg.includes('stroke="#FFFFFF"'), "Should have white stroke");
    assert.ok(svg.includes('stroke-width="2"'), "Should have 2px stroke width");
  });
});

describe("assignPieColors", () => {
  it("assigns colors from palette in order", () => {
    const slices = [
      { label: "A", value: 1 },
      { label: "B", value: 2 },
      { label: "C", value: 3 },
    ];

    const colored = assignPieColors(slices);

    assert.equal(colored[0].color, PALETTE[0]);
    assert.equal(colored[1].color, PALETTE[1]);
    assert.equal(colored[2].color, PALETTE[2]);
  });

  it("preserves existing colors", () => {
    const slices = [
      { label: "A", value: 1, color: "#123456" },
      { label: "B", value: 2 },
      { label: "C", value: 3, color: "#789ABC" },
    ];

    const colored = assignPieColors(slices);

    assert.equal(colored[0].color, "#123456", "Should preserve first custom color");
    assert.equal(colored[1].color, PALETTE[0], "Should assign palette to uncolored");
    assert.equal(colored[2].color, "#789ABC", "Should preserve second custom color");
  });

  it("wraps palette when more slices than colors", () => {
    const slices = Array.from({ length: 12 }, (_, i) => ({
      label: `Item ${i}`,
      value: 1,
    }));

    const colored = assignPieColors(slices);

    assert.equal(colored[10].color, PALETTE[0], "11th slice should wrap to first color");
    assert.equal(colored[11].color, PALETTE[1], "12th slice should wrap to second color");
  });
});

/**
 * Tests for chart data validation utilities
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  validatePieChartData,
  validateBarChartData,
  validateGroupedBarChartData,
  validateScatterChartData,
  validateSankeyChartData,
  validateQuoteChartData,
  formatValidationError,
} from "./validate.ts";

describe("validatePieChartData", () => {
  it("returns null for valid data", () => {
    const result = validatePieChartData({
      title: "Test",
      data: [{ label: "A", value: 100 }],
    });
    assert.equal(result, null);
  });

  it("returns error for non-object", () => {
    const result = validatePieChartData("not an object");
    assert.ok(result);
    assert.equal(result.field, "data");
    assert.ok(result.received.includes("string"));
  });

  it("returns error for missing data array", () => {
    const result = validatePieChartData({ title: "Test" });
    assert.ok(result);
    assert.equal(result.field, "data");
    assert.equal(result.expected, "array");
  });

  it("returns error for empty data array", () => {
    const result = validatePieChartData({ data: [] });
    assert.ok(result);
    assert.equal(result.field, "data");
    assert.ok(result.expected.includes("non-empty"));
  });

  it("returns error for invalid slice", () => {
    const result = validatePieChartData({
      data: [{ label: "A", value: "not a number" }],
    });
    assert.ok(result);
    assert.equal(result.field, "data[0].value");
    assert.ok(result.expected.includes("positive"));
  });

  it("returns error with received value in message", () => {
    const result = validatePieChartData({
      data: [{ label: "A", value: "abc" }],
    });
    assert.ok(result);
    assert.ok(result.received.includes("abc"));
    assert.ok(result.message.includes("abc"));
  });

  it("returns error for negative pie slice value", () => {
    const result = validatePieChartData({
      data: [{ label: "A", value: -50 }],
    });
    assert.ok(result);
    assert.equal(result.field, "data[0].value");
    assert.ok(result.expected.includes("positive"));
  });

  it("returns error for zero pie slice value", () => {
    const result = validatePieChartData({
      data: [{ label: "A", value: 0 }],
    });
    assert.ok(result);
    assert.equal(result.field, "data[0].value");
    assert.ok(result.expected.includes("> 0"));
  });

  it("returns error for Infinity pie slice value", () => {
    const result = validatePieChartData({
      data: [{ label: "A", value: Infinity }],
    });
    assert.ok(result);
    assert.equal(result.field, "data[0].value");
    assert.ok(result.expected.includes("finite"));
  });

  it("returns error for NaN pie slice value", () => {
    const result = validatePieChartData({
      data: [{ label: "A", value: NaN }],
    });
    assert.ok(result);
    assert.equal(result.field, "data[0].value");
    assert.ok(result.expected.includes("finite"));
  });
});

describe("validateBarChartData", () => {
  it("returns null for valid data", () => {
    const result = validateBarChartData({
      data: [{ label: "A", value: 100 }],
    });
    assert.equal(result, null);
  });

  it("returns error for invalid value type", () => {
    const result = validateBarChartData({
      data: [{ label: "A", value: true }],
    });
    assert.ok(result);
    assert.equal(result.field, "data[0].value");
    assert.ok(result.received.includes("boolean"));
  });

  it("allows zero bar value", () => {
    const result = validateBarChartData({
      data: [{ label: "A", value: 0 }],
    });
    assert.equal(result, null);
  });

  it("returns error for negative bar value", () => {
    const result = validateBarChartData({
      data: [{ label: "A", value: -100 }],
    });
    assert.ok(result);
    assert.equal(result.field, "data[0].value");
    assert.ok(result.expected.includes("non-negative"));
  });

  it("returns error for Infinity bar value", () => {
    const result = validateBarChartData({
      data: [{ label: "A", value: Infinity }],
    });
    assert.ok(result);
    assert.equal(result.field, "data[0].value");
    assert.ok(result.expected.includes("finite"));
  });
});

describe("validateGroupedBarChartData", () => {
  it("returns null for valid data", () => {
    const result = validateGroupedBarChartData({
      categories: ["Q1", "Q2"],
      series: [{ name: "A", values: [100, 200] }],
    });
    assert.equal(result, null);
  });

  it("returns error for mismatched values length", () => {
    const result = validateGroupedBarChartData({
      categories: ["Q1", "Q2", "Q3"],
      series: [{ name: "A", values: [100, 200] }],
    });
    assert.ok(result);
    assert.equal(result.field, "series[0].values");
    assert.ok(result.expected.includes("3 numbers"));
    assert.ok(result.received.includes("2"));
  });
});

describe("validateScatterChartData", () => {
  it("returns null for valid data", () => {
    const result = validateScatterChartData({
      series: [{ name: "A", points: [{ x: 1, y: 2 }] }],
    });
    assert.equal(result, null);
  });

  it("returns error for invalid point", () => {
    const result = validateScatterChartData({
      series: [{ name: "A", points: [{ x: "one", y: 2 }] }],
    });
    assert.ok(result);
    assert.equal(result.field, "series[0].points[0].x");
    assert.ok(result.received.includes("one"));
  });

  it("allows negative coordinates", () => {
    const result = validateScatterChartData({
      series: [{ name: "A", points: [{ x: -10, y: -20 }] }],
    });
    assert.equal(result, null);
  });

  it("returns error for Infinity coordinate", () => {
    const result = validateScatterChartData({
      series: [{ name: "A", points: [{ x: Infinity, y: 2 }] }],
    });
    assert.ok(result);
    assert.equal(result.field, "series[0].points[0].x");
    assert.ok(result.expected.includes("finite"));
  });

  it("returns error for NaN coordinate", () => {
    const result = validateScatterChartData({
      series: [{ name: "A", points: [{ x: 1, y: NaN }] }],
    });
    assert.ok(result);
    assert.equal(result.field, "series[0].points[0].y");
    assert.ok(result.expected.includes("finite"));
  });
});

describe("validateSankeyChartData", () => {
  it("returns null for valid data", () => {
    const result = validateSankeyChartData({
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      links: [{ source: "a", target: "b", value: 100 }],
    });
    assert.equal(result, null);
  });

  it("returns error for invalid node reference", () => {
    const result = validateSankeyChartData({
      nodes: [{ id: "a", label: "A" }],
      links: [{ source: "a", target: "b", value: 100 }],
    });
    assert.ok(result);
    assert.equal(result.field, "links[0].target");
    assert.ok(result.expected.includes("valid node id"));
    assert.ok(result.received.includes("b"));
  });

  it("returns error for negative link value", () => {
    const result = validateSankeyChartData({
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      links: [{ source: "a", target: "b", value: -50 }],
    });
    assert.ok(result);
    assert.equal(result.field, "links[0].value");
    assert.ok(result.expected.includes("positive"));
  });

  it("returns error for zero link value", () => {
    const result = validateSankeyChartData({
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      links: [{ source: "a", target: "b", value: 0 }],
    });
    assert.ok(result);
    assert.equal(result.field, "links[0].value");
    assert.ok(result.expected.includes("> 0"));
  });

  it("returns error for Infinity link value", () => {
    const result = validateSankeyChartData({
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      links: [{ source: "a", target: "b", value: Infinity }],
    });
    assert.ok(result);
    assert.equal(result.field, "links[0].value");
    assert.ok(result.expected.includes("finite"));
  });
});

describe("validateQuoteChartData", () => {
  it("returns null for valid data", () => {
    const result = validateQuoteChartData({
      text: "A great quote",
      authorName: "Jane Smith",
      authorTitle: "CEO",
    });
    assert.equal(result, null);
  });

  it("returns error for missing text", () => {
    const result = validateQuoteChartData({});
    assert.ok(result);
    assert.equal(result.field, "text");
  });

  it("returns error for empty text", () => {
    const result = validateQuoteChartData({ text: "   " });
    assert.ok(result);
    assert.equal(result.field, "text");
    assert.ok(result.expected.includes("non-empty"));
  });

  it("returns error for invalid style", () => {
    const result = validateQuoteChartData({
      text: "Quote",
      style: "fancy",
    });
    assert.ok(result);
    assert.equal(result.field, "style");
    assert.ok(result.received.includes("fancy"));
  });
});

describe("formatValidationError", () => {
  it("formats error with example", () => {
    const err = {
      field: "data[0].value",
      expected: "number",
      received: 'string: "abc"',
      message: 'Invalid data[0].value: expected number, received string: "abc"',
    };
    const formatted = formatValidationError(err, '{ "data": [{ "label": "A", "value": 100 }] }');

    assert.ok(formatted.includes("Error: Invalid data[0].value"));
    assert.ok(formatted.includes("Expected: number"));
    assert.ok(formatted.includes('Received: string: "abc"'));
    assert.ok(formatted.includes('Example:'));
    assert.ok(formatted.includes('"value": 100'));
  });
});

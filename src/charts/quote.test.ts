/**
 * Tests for quote/testimonial card SVG generation
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { generateQuote } from "./quote.ts";
import type { QuoteChartData } from "./types.ts";

describe("generateQuote", () => {
  it("generates valid SVG structure", () => {
    const data: QuoteChartData = {
      text: "This product changed everything.",
      authorName: "Jane Smith",
    };

    const svg = generateQuote(data);

    assert.ok(svg.startsWith("<svg"), "Should start with <svg tag");
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), "Should have SVG namespace");
    assert.ok(svg.includes('role="img"'), "Should have role=img for accessibility");
    assert.ok(svg.endsWith("</svg>"), "Should end with closing svg tag");
  });

  it("includes quote text", () => {
    const data: QuoteChartData = {
      text: "This is a testimonial quote.",
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes("This is a testimonial quote"), "Should contain quote text");
  });

  it("includes authorName when provided", () => {
    const data: QuoteChartData = {
      text: "Great product!",
      authorName: "John Doe",
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes("John Doe"), "Should contain author name");
  });

  it("includes authorTitle when provided", () => {
    const data: QuoteChartData = {
      text: "Excellent service.",
      authorName: "Jane Smith",
      authorTitle: "CEO",
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes("CEO"), "Should contain author title");
  });

  it("includes company when provided", () => {
    const data: QuoteChartData = {
      text: "Highly recommend.",
      authorName: "Bob Johnson",
      company: "Acme Corp",
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes("Acme Corp"), "Should contain company name");
  });

  it("renders avatar placeholder when requested", () => {
    const data: QuoteChartData = {
      text: "Love it!",
      authorName: "Alice",
      avatarPlaceholder: true,
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes("<circle"), "Should contain circle element for avatar");
  });

  it("uses custom accent color", () => {
    const data: QuoteChartData = {
      text: "Amazing!",
      accentColor: "#FF5733",
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes("#FF5733"), "Should use custom accent color");
  });

  it("respects custom dimensions", () => {
    const data: QuoteChartData = {
      text: "Test quote.",
    };

    const svg = generateQuote(data, { width: 800, height: 400 });

    assert.ok(svg.includes('viewBox="0 0 800 400"'), "Should have correct viewBox");
    assert.ok(svg.includes('width="800"'), "Should have correct width");
    assert.ok(svg.includes('height="400"'), "Should have correct height");
  });

  it("renders card style by default", () => {
    const data: QuoteChartData = {
      text: "Default style test.",
    };

    const svg = generateQuote(data);

    // Card style has drop shadow filter
    assert.ok(svg.includes('filter="url(#shadow)"'), "Should have shadow filter for card style");
    assert.ok(svg.includes("<rect"), "Should have background rect");
  });

  it("renders minimal style when specified", () => {
    const data: QuoteChartData = {
      text: "Minimal style test.",
      style: "minimal",
    };

    const svg = generateQuote(data);

    // Minimal style centers text
    assert.ok(svg.includes('text-anchor="middle"'), "Should center text in minimal style");
    // Minimal has no shadow filter
    assert.ok(!svg.includes('filter="url(#shadow)"'), "Should not have shadow in minimal style");
  });

  it("renders elegant style when specified", () => {
    const data: QuoteChartData = {
      text: "Elegant style test.",
      style: "elegant",
    };

    const svg = generateQuote(data);

    // Elegant style has accent line
    assert.ok(svg.includes('width="4"'), "Should have accent line in elegant style");
  });

  it("overrides data style with options style", () => {
    const data: QuoteChartData = {
      text: "Style override test.",
      style: "card",
    };

    const svg = generateQuote(data, { style: "minimal" });

    // Should use minimal (from options) not card (from data)
    assert.ok(svg.includes('text-anchor="middle"'), "Options style should override data style");
  });

  it("includes title element for accessibility", () => {
    const data: QuoteChartData = {
      text: "Accessible quote.",
      authorName: "Test User",
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes("<title>"), "Should have title element");
    assert.ok(svg.includes('aria-label="Quote from Test User"'), "Should have aria-label");
  });

  it("handles missing authorName in aria-label", () => {
    const data: QuoteChartData = {
      text: "Anonymous quote.",
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes('aria-label="Quote from Anonymous"'), "Should fallback to Anonymous");
  });

  it("wraps long quote text", () => {
    const data: QuoteChartData = {
      text: "This is a very long testimonial quote that should wrap across multiple lines because it exceeds the available width in the SVG container.",
    };

    const svg = generateQuote(data);

    // Multiple text elements indicate wrapped lines
    const textMatches = svg.match(/<text /g);
    assert.ok(textMatches && textMatches.length > 1, "Should have multiple text elements for wrapped text");
  });

  it("escapes special XML characters", () => {
    const data: QuoteChartData = {
      text: "Products & Services <value>",
      authorName: "Smith & Jones",
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes("&amp;"), "Should escape ampersand");
    assert.ok(svg.includes("&lt;"), "Should escape less-than");
    assert.ok(svg.includes("&gt;"), "Should escape greater-than");
  });

  it("renders full author block", () => {
    const data: QuoteChartData = {
      text: "Complete testimonial.",
      authorName: "Jane Smith",
      authorTitle: "CEO",
      company: "Acme Corp",
    };

    const svg = generateQuote(data);

    assert.ok(svg.includes("Jane Smith"), "Should include authorName");
    assert.ok(svg.includes("CEO"), "Should include authorTitle");
    assert.ok(svg.includes("Acme Corp"), "Should include company");
  });
});

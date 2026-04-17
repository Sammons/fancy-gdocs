/**
 * Chart CLI router — routes chart subcommands to appropriate generators.
 *
 * Usage:
 *   pnpm gdocs chart pie /tmp/data.json [--out /tmp/chart.svg] [--width 400] [--height 400]
 *   pnpm gdocs chart bar /tmp/data.json [--out /tmp/chart.svg] [--horizontal] [--stacked]
 *   pnpm gdocs chart scatter /tmp/data.json [--out /tmp/chart.svg] [--trend-line]
 *   pnpm gdocs chart sankey /tmp/data.json [--out /tmp/chart.svg]
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { generatePie } from "./pie.ts";
import { generateBar } from "./bar.ts";
import { generateScatter } from "./scatter.ts";
import { generateSankey } from "./sankey.ts";
import { generateQuote } from "./quote.ts";
import {
  isBarChartData,
  isGroupedBarChartData,
  type ChartOptions,
  type BarChartOptions,
  type ScatterChartOptions,
  type QuoteChartOptions,
  type PieChartData,
  type BarChartData,
  type GroupedBarChartData,
  type ScatterChartData,
  type SankeyChartData,
  type QuoteChartData,
} from "./types.ts";
import {
  validatePieChartData,
  validateBarChartData,
  validateGroupedBarChartData,
  validateScatterChartData,
  validateSankeyChartData,
  validateQuoteChartData,
  formatValidationError,
  checkUnknownFields,
  formatUnknownFieldWarning,
  KNOWN_FIELDS,
} from "./validate.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function takeFlag(argv: string[], name: string): { present: boolean; remaining: string[] } {
  const flag = `--${name}`;
  const remaining: string[] = [];
  let present = false;
  for (const arg of argv) {
    if (arg === flag) {
      present = true;
    } else {
      remaining.push(arg);
    }
  }
  return { present, remaining };
}

function takeOption(argv: string[], name: string): { value: string | undefined; remaining: string[] } {
  const flag = `--${name}`;
  const prefix = `${flag}=`;
  const remaining: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === flag) {
      value = argv[++i];
    } else if (arg.startsWith(prefix)) {
      value = arg.slice(prefix.length);
    } else {
      remaining.push(arg);
    }
  }
  return { value, remaining };
}

function parseIntOption(argv: string[], name: string, defaultValue: number): { value: number; remaining: string[] } {
  const { value, remaining } = takeOption(argv, name);
  if (value === undefined) return { value: defaultValue, remaining };
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    fail(`--${name} must be a positive integer, got: ${value}`);
  }
  return { value: parsed, remaining };
}

function readJsonFile(filePath: string): unknown {
  try {
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err: any) {
    fail(`Error reading JSON file at ${filePath}: ${err.message}`);
  }
}

function writeOutput(svg: string, outPath: string | undefined): void {
  if (outPath) {
    writeFileSync(outPath, svg);
    console.error(`Wrote: ${outPath}`);
  } else {
    console.log(svg);
  }
}

// ---------------------------------------------------------------------------
// Example data for --example flag
// ---------------------------------------------------------------------------

const EXAMPLES = {
  pie: {
    data: [
      { label: "Category A", value: 60 },
      { label: "Category B", value: 40 },
    ],
  },
  bar: {
    simple: {
      xAxis: "Category",
      yAxis: "Value",
      data: [
        { label: "A", value: 100 },
        { label: "B", value: 200 },
      ],
    },
    grouped: {
      title: "Quarterly Comparison",
      xAxis: "Quarter",
      yAxis: "Revenue",
      categories: ["Q1", "Q2", "Q3", "Q4"],
      series: [
        { name: "2024", values: [100, 120, 150, 180] },
        { name: "2025", values: [110, 140, 170, 200] },
      ],
    },
    stacked: {
      title: "Stacked Revenue",
      xAxis: "Quarter",
      yAxis: "Revenue",
      categories: ["Q1", "Q2", "Q3", "Q4"],
      series: [
        { name: "Product A", values: [50, 60, 70, 80] },
        { name: "Product B", values: [30, 40, 50, 60] },
        { name: "Product C", values: [20, 20, 30, 40] },
      ],
    },
  },
  scatter: {
    simple: {
      series: [
        {
          name: "Series A",
          points: [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
          ],
        },
      ],
    },
    multi: {
      title: "Multi-Series Comparison",
      xAxis: "Time",
      yAxis: "Value",
      series: [
        {
          name: "Dataset A",
          points: [
            { x: 1, y: 10 },
            { x: 2, y: 15 },
            { x: 3, y: 12 },
            { x: 4, y: 18 },
          ],
        },
        {
          name: "Dataset B",
          points: [
            { x: 1, y: 8 },
            { x: 2, y: 12 },
            { x: 3, y: 16 },
            { x: 4, y: 14 },
          ],
        },
      ],
    },
  },
  sankey: {
    nodes: [
      { id: "a", label: "Source" },
      { id: "b", label: "Target" },
    ],
    links: [{ source: "a", target: "b", value: 100 }],
  },
  quote: {
    text: "This is an example quote.",
    authorName: "Jane Smith",
    authorTitle: "CEO",
  },
};

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

function handlePie(args: string[]): void {
  let remaining = args;

  const exampleResult = takeFlag(remaining, "example");
  remaining = exampleResult.remaining;
  if (exampleResult.present) {
    console.log(JSON.stringify(EXAMPLES.pie, null, 2));
    return;
  }

  const outResult = takeOption(remaining, "out");
  remaining = outResult.remaining;
  const outPath = outResult.value;

  const widthResult = parseIntOption(remaining, "width", 400);
  remaining = widthResult.remaining;
  const width = widthResult.value;

  const heightResult = parseIntOption(remaining, "height", 400);
  remaining = heightResult.remaining;
  const height = heightResult.value;

  const filePath = remaining[0];
  if (!filePath) {
    fail("Usage: pnpm gdocs chart pie <file.json> [--out /tmp/chart.svg] [--width 400] [--height 400]");
  }

  const data = readJsonFile(path.resolve(filePath));
  const validationErr = validatePieChartData(data);
  if (validationErr) {
    fail(formatValidationError(validationErr, '{ "data": [{ "label": "A", "value": 100 }] }'));
  }

  // Check for unknown fields
  const unknownFields = checkUnknownFields(data as object, KNOWN_FIELDS.pie);
  if (unknownFields.length > 0) {
    console.error(formatUnknownFieldWarning(unknownFields, "pie"));
  }

  const opts: ChartOptions = { width, height };
  const svg = generatePie(data as PieChartData, opts);
  writeOutput(svg, outPath);
}

function handleBar(args: string[]): void {
  let remaining = args;

  const exampleResult = takeOption(remaining, "example");
  remaining = exampleResult.remaining;
  if (exampleResult.value !== undefined || args.includes("--example")) {
    // Handle --example with no value (returns undefined from takeOption)
    const variant = exampleResult.value || "simple";
    if (variant === "simple" || variant === "grouped" || variant === "stacked") {
      console.log(JSON.stringify(EXAMPLES.bar[variant], null, 2));
    } else {
      fail(`Unknown bar example variant: ${variant}. Supported: simple, grouped, stacked`);
    }
    return;
  }

  const outResult = takeOption(remaining, "out");
  remaining = outResult.remaining;
  const outPath = outResult.value;

  const widthResult = parseIntOption(remaining, "width", 600);
  remaining = widthResult.remaining;
  const width = widthResult.value;

  const heightResult = parseIntOption(remaining, "height", 400);
  remaining = heightResult.remaining;
  const height = heightResult.value;

  const horizontalResult = takeFlag(remaining, "horizontal");
  remaining = horizontalResult.remaining;
  const horizontal = horizontalResult.present;

  const stackedResult = takeFlag(remaining, "stacked");
  remaining = stackedResult.remaining;
  const stacked = stackedResult.present;

  const filePath = remaining[0];
  if (!filePath) {
    fail("Usage: pnpm gdocs chart bar <file.json> [--out /tmp/chart.svg] [--horizontal] [--stacked]");
  }

  const data = readJsonFile(path.resolve(filePath));
  // Try simple bar chart first, then grouped
  const obj = data as Record<string, unknown>;
  const isGrouped = obj && typeof obj === "object" && ("categories" in obj || "series" in obj);

  if (!isBarChartData(data) && !isGroupedBarChartData(data)) {
    // Check which format was likely intended based on presence of keys
    if (isGrouped) {
      const validationErr = validateGroupedBarChartData(data);
      if (validationErr) {
        fail(formatValidationError(validationErr, '{ "categories": ["Q1", "Q2"], "series": [{ "name": "A", "values": [100, 200] }] }'));
      }
    } else {
      const validationErr = validateBarChartData(data);
      if (validationErr) {
        fail(formatValidationError(validationErr, '{ "data": [{ "label": "A", "value": 100 }] }'));
      }
    }
  }

  // Check for unknown fields
  const knownFields = isGrouped ? KNOWN_FIELDS.groupedBar : KNOWN_FIELDS.bar;
  const unknownFields = checkUnknownFields(data as object, knownFields);
  if (unknownFields.length > 0) {
    console.error(formatUnknownFieldWarning(unknownFields, isGrouped ? "groupedBar" : "bar"));
  }

  const opts: BarChartOptions = { width, height, horizontal, stacked };
  const svg = generateBar(data as BarChartData | GroupedBarChartData, opts);
  writeOutput(svg, outPath);
}

function handleScatter(args: string[]): void {
  let remaining = args;

  const exampleResult = takeOption(remaining, "example");
  remaining = exampleResult.remaining;
  if (exampleResult.value !== undefined || args.includes("--example")) {
    const variant = exampleResult.value || "simple";
    if (variant === "simple" || variant === "multi") {
      console.log(JSON.stringify(EXAMPLES.scatter[variant], null, 2));
    } else {
      fail(`Unknown scatter example variant: ${variant}. Supported: simple, multi`);
    }
    return;
  }

  const outResult = takeOption(remaining, "out");
  remaining = outResult.remaining;
  const outPath = outResult.value;

  const widthResult = parseIntOption(remaining, "width", 600);
  remaining = widthResult.remaining;
  const width = widthResult.value;

  const heightResult = parseIntOption(remaining, "height", 400);
  remaining = heightResult.remaining;
  const height = heightResult.value;

  const trendLineResult = takeFlag(remaining, "trend-line");
  remaining = trendLineResult.remaining;
  const trendLine = trendLineResult.present;

  const filePath = remaining[0];
  if (!filePath) {
    fail("Usage: pnpm gdocs chart scatter <file.json> [--out /tmp/chart.svg] [--trend-line]");
  }

  const data = readJsonFile(path.resolve(filePath));
  const validationErr = validateScatterChartData(data);
  if (validationErr) {
    fail(formatValidationError(validationErr, '{ "series": [{ "name": "A", "points": [{ "x": 1, "y": 2 }] }] }'));
  }

  // Check for unknown fields
  const unknownFields = checkUnknownFields(data as object, KNOWN_FIELDS.scatter);
  if (unknownFields.length > 0) {
    console.error(formatUnknownFieldWarning(unknownFields, "scatter"));
  }

  const opts: ScatterChartOptions = { width, height, trendLine };
  const svg = generateScatter(data as ScatterChartData, opts);
  writeOutput(svg, outPath);
}

function handleSankey(args: string[]): void {
  let remaining = args;

  const exampleResult = takeFlag(remaining, "example");
  remaining = exampleResult.remaining;
  if (exampleResult.present) {
    console.log(JSON.stringify(EXAMPLES.sankey, null, 2));
    return;
  }

  const outResult = takeOption(remaining, "out");
  remaining = outResult.remaining;
  const outPath = outResult.value;

  const widthResult = parseIntOption(remaining, "width", 800);
  remaining = widthResult.remaining;
  const width = widthResult.value;

  const heightResult = parseIntOption(remaining, "height", 500);
  remaining = heightResult.remaining;
  const height = heightResult.value;

  const filePath = remaining[0];
  if (!filePath) {
    fail("Usage: pnpm gdocs chart sankey <file.json> [--out /tmp/chart.svg] [--width 800] [--height 500]");
  }

  const data = readJsonFile(path.resolve(filePath));
  const validationErr = validateSankeyChartData(data);
  if (validationErr) {
    fail(formatValidationError(validationErr, '{ "nodes": [{ "id": "a", "label": "A" }], "links": [{ "source": "a", "target": "b", "value": 100 }] }'));
  }

  // Check for unknown fields
  const unknownFields = checkUnknownFields(data as object, KNOWN_FIELDS.sankey);
  if (unknownFields.length > 0) {
    console.error(formatUnknownFieldWarning(unknownFields, "sankey"));
  }

  const opts: ChartOptions = { width, height };
  const svg = generateSankey(data as SankeyChartData, opts);
  writeOutput(svg, outPath);
}

function handleQuote(args: string[]): void {
  let remaining = args;

  const exampleResult = takeFlag(remaining, "example");
  remaining = exampleResult.remaining;
  if (exampleResult.present) {
    console.log(JSON.stringify(EXAMPLES.quote, null, 2));
    return;
  }

  const outResult = takeOption(remaining, "out");
  remaining = outResult.remaining;
  const outPath = outResult.value;

  const widthResult = parseIntOption(remaining, "width", 600);
  remaining = widthResult.remaining;
  const width = widthResult.value;

  const heightResult = parseIntOption(remaining, "height", 300);
  remaining = heightResult.remaining;
  const height = heightResult.value;

  const styleResult = takeOption(remaining, "style");
  remaining = styleResult.remaining;
  const style = styleResult.value as "card" | "minimal" | "elegant" | undefined;

  const filePath = remaining[0];
  if (!filePath) {
    fail("Usage: pnpm gdocs chart quote <file.json> [--out /tmp/quote.svg] [--width 600] [--height 300] [--style elegant]");
  }

  const data = readJsonFile(path.resolve(filePath));
  const quoteValidationErr = validateQuoteChartData(data);
  if (quoteValidationErr) {
    fail(formatValidationError(quoteValidationErr, '{ "text": "Quote text...", "authorName": "Jane Smith", "authorTitle": "CEO" }'));
  }

  // Check for unknown fields
  const unknownFields = checkUnknownFields(data as object, KNOWN_FIELDS.quote);
  if (unknownFields.length > 0) {
    console.error(formatUnknownFieldWarning(unknownFields, "quote"));
  }

  const opts: QuoteChartOptions = { width, height };
  if (style) {
    if (!["card", "minimal", "elegant"].includes(style)) {
      fail(`Invalid style: ${style}. Must be one of: card, minimal, elegant`);
    }
    opts.style = style;
  }
  const svg = generateQuote(data as QuoteChartData, opts);
  writeOutput(svg, outPath);
}

function printChartHelp(): void {
  console.log(`gdocs chart — Generate SVG charts from JSON data.

Usage:
  pnpm gdocs chart <type> <file.json> [options]
  pnpm gdocs chart <type> --example [variant]

Chart types:
  pie      Pie chart with optional legend
  bar      Bar chart (simple or grouped/stacked)
  scatter  Scatter plot with optional trend lines
  sankey   Sankey diagram for flow visualization
  quote    Testimonial/quote card

Common options:
  --example [v]    Print example JSON (variants: bar=simple|grouped|stacked, scatter=simple|multi)
  --out <path>     Write SVG to file instead of stdout
  --width <n>      Chart width in pixels (default varies by type)
  --height <n>     Chart height in pixels (default varies by type)

Bar chart options:
  --horizontal     Render bars horizontally
  --stacked        Stack grouped bars instead of side-by-side

Scatter chart options:
  --trend-line     Add linear trend line to each series

Quote chart options:
  --style <s>      Style: card (default), minimal, elegant

Examples:
  pnpm gdocs chart pie --example
  pnpm gdocs chart bar --example grouped
  pnpm gdocs chart bar --example stacked
  pnpm gdocs chart scatter --example multi
  pnpm gdocs chart pie /tmp/pie.json --out /tmp/pie.svg
  pnpm gdocs chart bar /tmp/bar.json --horizontal --out /tmp/bar.svg
  pnpm gdocs chart scatter /tmp/scatter.json --trend-line
  pnpm gdocs chart sankey /tmp/sankey.json --width 1000
  pnpm gdocs chart quote /tmp/quote.json --style elegant`);
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

export function handleChart(args: string[]): void {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case "pie":
      handlePie(rest);
      break;
    case "bar":
      handleBar(rest);
      break;
    case "scatter":
      handleScatter(rest);
      break;
    case "sankey":
      handleSankey(rest);
      break;
    case "quote":
      handleQuote(rest);
      break;
    case "help":
    case "--help":
    case "-h":
      printChartHelp();
      break;
    case undefined:
      fail(`Missing chart type. Run "pnpm gdocs chart help" for usage.`);
    default:
      fail(`Unknown chart type: ${subcommand}. Supported: pie, bar, scatter, sankey, quote`);
  }
}

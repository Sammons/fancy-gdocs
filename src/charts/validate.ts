/**
 * Validation utilities with detailed, actionable error messages for LLM callers.
 *
 * Returns the first validation error encountered (for actionable feedback)
 * rather than collecting all errors (which can be overwhelming).
 */

/** Validation error with field path, expected/received types, and human-readable message */
export interface ValidationError {
  field: string;      // e.g., "data[0].value"
  expected: string;   // e.g., "number"
  received: string;   // e.g., "string: 'abc'"
  message: string;    // Human-readable error
}

/**
 * Check if a value is a finite positive number (not NaN, not Infinity, > 0).
 * Used for chart values like pie slices where negative/zero/infinity breaks rendering.
 */
function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Check if a value is a finite number (not NaN, not Infinity).
 * Used for coordinates where negative is valid but infinity/NaN would break SVG.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Format a received value for display.
 */
function formatReceived(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `string: "${value.length > 50 ? value.slice(0, 47) + "..." : value}"`;
  if (typeof value === "number") return `number: ${value}`;
  if (typeof value === "boolean") return `boolean: ${value}`;
  if (Array.isArray(value)) return `array (length ${value.length})`;
  if (typeof value === "object") return `object with keys: [${Object.keys(value).join(", ")}]`;
  return String(typeof value);
}

/**
 * Create a validation error object.
 */
function error(field: string, expected: string, received: unknown): ValidationError {
  const receivedStr = formatReceived(received);
  return {
    field,
    expected,
    received: receivedStr,
    message: `Invalid ${field}: expected ${expected}, received ${receivedStr}`,
  };
}

// ---------------------------------------------------------------------------
// Pie Chart
// ---------------------------------------------------------------------------

/**
 * Validate PieChartData structure.
 *
 * Expected format:
 * ```json
 * {
 *   "title": "Optional title",
 *   "data": [
 *     { "label": "Category A", "value": 100 },
 *     { "label": "Category B", "value": 200 }
 *   ]
 * }
 * ```
 */
export function validatePieChartData(data: unknown): ValidationError | null {
  if (typeof data !== "object" || data === null) {
    return error("data", "object", data);
  }
  const obj = data as Record<string, unknown>;

  if (obj.title !== undefined && typeof obj.title !== "string") {
    return error("title", "string (optional)", obj.title);
  }

  if (!Array.isArray(obj.data)) {
    return error("data", "array", obj.data);
  }

  if (obj.data.length === 0) {
    return error("data", "non-empty array", obj.data);
  }

  for (let i = 0; i < obj.data.length; i++) {
    const item = obj.data[i];
    if (typeof item !== "object" || item === null) {
      return error(`data[${i}]`, "object with { label, value }", item);
    }
    const slice = item as Record<string, unknown>;
    if (typeof slice.label !== "string") {
      return error(`data[${i}].label`, "string", slice.label);
    }
    if (!isFinitePositive(slice.value)) {
      return error(`data[${i}].value`, "positive finite number (> 0)", slice.value);
    }
    if (slice.color !== undefined && typeof slice.color !== "string") {
      return error(`data[${i}].color`, "string (optional)", slice.color);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Bar Chart (Simple)
// ---------------------------------------------------------------------------

/**
 * Validate BarChartData structure (simple bar chart).
 *
 * Expected format:
 * ```json
 * {
 *   "title": "Optional title",
 *   "xAxis": "X axis label",
 *   "yAxis": "Y axis label",
 *   "data": [
 *     { "label": "A", "value": 100 },
 *     { "label": "B", "value": 200 }
 *   ]
 * }
 * ```
 */
export function validateBarChartData(data: unknown): ValidationError | null {
  if (typeof data !== "object" || data === null) {
    return error("data", "object", data);
  }
  const obj = data as Record<string, unknown>;

  if (obj.title !== undefined && typeof obj.title !== "string") {
    return error("title", "string (optional)", obj.title);
  }
  if (obj.xAxis !== undefined && typeof obj.xAxis !== "string") {
    return error("xAxis", "string (optional)", obj.xAxis);
  }
  if (obj.yAxis !== undefined && typeof obj.yAxis !== "string") {
    return error("yAxis", "string (optional)", obj.yAxis);
  }

  if (!Array.isArray(obj.data)) {
    return error("data", "array", obj.data);
  }

  if (obj.data.length === 0) {
    return error("data", "non-empty array", obj.data);
  }

  for (let i = 0; i < obj.data.length; i++) {
    const item = obj.data[i];
    if (typeof item !== "object" || item === null) {
      return error(`data[${i}]`, "object with { label, value }", item);
    }
    const point = item as Record<string, unknown>;
    if (typeof point.label !== "string") {
      return error(`data[${i}].label`, "string", point.label);
    }
    if (!isFiniteNumber(point.value) || point.value < 0) {
      return error(`data[${i}].value`, "non-negative finite number (>= 0)", point.value);
    }
    if (point.color !== undefined && typeof point.color !== "string") {
      return error(`data[${i}].color`, "string (optional)", point.color);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Grouped/Stacked Bar Chart
// ---------------------------------------------------------------------------

/**
 * Validate GroupedBarChartData structure.
 *
 * Expected format:
 * ```json
 * {
 *   "title": "Optional title",
 *   "categories": ["Q1", "Q2", "Q3"],
 *   "series": [
 *     { "name": "Product A", "values": [100, 120, 140] },
 *     { "name": "Product B", "values": [80, 90, 100] }
 *   ]
 * }
 * ```
 */
export function validateGroupedBarChartData(data: unknown): ValidationError | null {
  if (typeof data !== "object" || data === null) {
    return error("data", "object", data);
  }
  const obj = data as Record<string, unknown>;

  if (obj.title !== undefined && typeof obj.title !== "string") {
    return error("title", "string (optional)", obj.title);
  }
  if (obj.xAxis !== undefined && typeof obj.xAxis !== "string") {
    return error("xAxis", "string (optional)", obj.xAxis);
  }
  if (obj.yAxis !== undefined && typeof obj.yAxis !== "string") {
    return error("yAxis", "string (optional)", obj.yAxis);
  }

  if (!Array.isArray(obj.categories)) {
    return error("categories", "array of strings", obj.categories);
  }
  for (let i = 0; i < obj.categories.length; i++) {
    if (typeof obj.categories[i] !== "string") {
      return error(`categories[${i}]`, "string", obj.categories[i]);
    }
  }

  if (!Array.isArray(obj.series)) {
    return error("series", "array", obj.series);
  }

  if (obj.series.length === 0) {
    return error("series", "non-empty array", obj.series);
  }

  const categoryCount = obj.categories.length;
  for (let i = 0; i < obj.series.length; i++) {
    const series = obj.series[i];
    if (typeof series !== "object" || series === null) {
      return error(`series[${i}]`, "object with { name, values }", series);
    }
    const s = series as Record<string, unknown>;
    if (typeof s.name !== "string") {
      return error(`series[${i}].name`, "string", s.name);
    }
    if (!Array.isArray(s.values)) {
      return error(`series[${i}].values`, "array of numbers", s.values);
    }
    if (s.values.length !== categoryCount) {
      return error(
        `series[${i}].values`,
        `array of ${categoryCount} numbers (matching categories length)`,
        `array of ${s.values.length} items`
      );
    }
    for (let j = 0; j < s.values.length; j++) {
      if (!isFiniteNumber(s.values[j]) || (s.values[j] as number) < 0) {
        return error(`series[${i}].values[${j}]`, "non-negative finite number (>= 0)", s.values[j]);
      }
    }
    if (s.color !== undefined && typeof s.color !== "string") {
      return error(`series[${i}].color`, "string (optional)", s.color);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Scatter Chart
// ---------------------------------------------------------------------------

/**
 * Validate ScatterChartData structure.
 *
 * Expected format:
 * ```json
 * {
 *   "title": "Optional title",
 *   "xAxis": "X variable",
 *   "yAxis": "Y variable",
 *   "series": [
 *     { "name": "Group A", "points": [{ "x": 1, "y": 2 }, { "x": 3, "y": 4 }] }
 *   ]
 * }
 * ```
 */
export function validateScatterChartData(data: unknown): ValidationError | null {
  if (typeof data !== "object" || data === null) {
    return error("data", "object", data);
  }
  const obj = data as Record<string, unknown>;

  if (obj.title !== undefined && typeof obj.title !== "string") {
    return error("title", "string (optional)", obj.title);
  }
  if (obj.xAxis !== undefined && typeof obj.xAxis !== "string") {
    return error("xAxis", "string (optional)", obj.xAxis);
  }
  if (obj.yAxis !== undefined && typeof obj.yAxis !== "string") {
    return error("yAxis", "string (optional)", obj.yAxis);
  }

  if (!Array.isArray(obj.series)) {
    return error("series", "array", obj.series);
  }

  for (let i = 0; i < obj.series.length; i++) {
    const series = obj.series[i];
    if (typeof series !== "object" || series === null) {
      return error(`series[${i}]`, "object with { name, points }", series);
    }
    const s = series as Record<string, unknown>;
    if (typeof s.name !== "string") {
      return error(`series[${i}].name`, "string", s.name);
    }
    if (!Array.isArray(s.points)) {
      return error(`series[${i}].points`, "array of { x, y } objects", s.points);
    }
    for (let j = 0; j < s.points.length; j++) {
      const pt = s.points[j];
      if (typeof pt !== "object" || pt === null) {
        return error(`series[${i}].points[${j}]`, "object with { x, y }", pt);
      }
      const p = pt as Record<string, unknown>;
      if (!isFiniteNumber(p.x)) {
        return error(`series[${i}].points[${j}].x`, "finite number (not NaN/Infinity)", p.x);
      }
      if (!isFiniteNumber(p.y)) {
        return error(`series[${i}].points[${j}].y`, "finite number (not NaN/Infinity)", p.y);
      }
    }
    if (s.color !== undefined && typeof s.color !== "string") {
      return error(`series[${i}].color`, "string (optional)", s.color);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sankey Chart
// ---------------------------------------------------------------------------

/**
 * Validate SankeyChartData structure.
 *
 * Expected format:
 * ```json
 * {
 *   "title": "Optional title",
 *   "nodes": [
 *     { "id": "a", "label": "Source A" },
 *     { "id": "b", "label": "Target B" }
 *   ],
 *   "links": [
 *     { "source": "a", "target": "b", "value": 100 }
 *   ]
 * }
 * ```
 */
export function validateSankeyChartData(data: unknown): ValidationError | null {
  if (typeof data !== "object" || data === null) {
    return error("data", "object", data);
  }
  const obj = data as Record<string, unknown>;

  if (obj.title !== undefined && typeof obj.title !== "string") {
    return error("title", "string (optional)", obj.title);
  }

  if (!Array.isArray(obj.nodes)) {
    return error("nodes", "array", obj.nodes);
  }

  const nodeIds = new Set<string>();
  for (let i = 0; i < obj.nodes.length; i++) {
    const node = obj.nodes[i];
    if (typeof node !== "object" || node === null) {
      return error(`nodes[${i}]`, "object with { id, label }", node);
    }
    const n = node as Record<string, unknown>;
    if (typeof n.id !== "string") {
      return error(`nodes[${i}].id`, "string", n.id);
    }
    if (typeof n.label !== "string") {
      return error(`nodes[${i}].label`, "string", n.label);
    }
    if (n.color !== undefined && typeof n.color !== "string") {
      return error(`nodes[${i}].color`, "string (optional)", n.color);
    }
    nodeIds.add(n.id);
  }

  if (!Array.isArray(obj.links)) {
    return error("links", "array", obj.links);
  }

  for (let i = 0; i < obj.links.length; i++) {
    const link = obj.links[i];
    if (typeof link !== "object" || link === null) {
      return error(`links[${i}]`, "object with { source, target, value }", link);
    }
    const l = link as Record<string, unknown>;
    if (typeof l.source !== "string") {
      return error(`links[${i}].source`, "string (node id)", l.source);
    }
    if (!nodeIds.has(l.source)) {
      return error(`links[${i}].source`, `valid node id (one of: ${[...nodeIds].join(", ")})`, l.source);
    }
    if (typeof l.target !== "string") {
      return error(`links[${i}].target`, "string (node id)", l.target);
    }
    if (!nodeIds.has(l.target)) {
      return error(`links[${i}].target`, `valid node id (one of: ${[...nodeIds].join(", ")})`, l.target);
    }
    if (!isFinitePositive(l.value)) {
      return error(`links[${i}].value`, "positive finite number (> 0)", l.value);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Quote Chart
// ---------------------------------------------------------------------------

/**
 * Validate QuoteChartData structure.
 *
 * Expected format:
 * ```json
 * {
 *   "text": "The quote text here...",
 *   "authorName": "Jane Smith",
 *   "authorTitle": "CEO",
 *   "company": "Acme Corp",
 *   "avatarPlaceholder": true,
 *   "style": "card",
 *   "accentColor": "#4285F4"
 * }
 * ```
 */
export function validateQuoteChartData(data: unknown): ValidationError | null {
  if (typeof data !== "object" || data === null) {
    return error("data", "object", data);
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj.text !== "string") {
    return error("text", "string (the quote text)", obj.text);
  }
  if (obj.text.trim().length === 0) {
    return error("text", "non-empty string", obj.text);
  }
  if (obj.authorName !== undefined && typeof obj.authorName !== "string") {
    return error("authorName", "string (optional)", obj.authorName);
  }
  if (obj.authorTitle !== undefined && typeof obj.authorTitle !== "string") {
    return error("authorTitle", "string (optional)", obj.authorTitle);
  }
  if (obj.company !== undefined && typeof obj.company !== "string") {
    return error("company", "string (optional)", obj.company);
  }
  if (obj.avatarPlaceholder !== undefined && typeof obj.avatarPlaceholder !== "boolean") {
    return error("avatarPlaceholder", "boolean (optional)", obj.avatarPlaceholder);
  }
  if (obj.style !== undefined) {
    if (typeof obj.style !== "string") {
      return error("style", '"card" | "minimal" | "elegant" (optional)', obj.style);
    }
    if (!["card", "minimal", "elegant"].includes(obj.style)) {
      return error("style", '"card" | "minimal" | "elegant"', obj.style);
    }
  }
  if (obj.accentColor !== undefined && typeof obj.accentColor !== "string") {
    return error("accentColor", "string (optional, e.g., '#4285F4')", obj.accentColor);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Unknown field detection
// ---------------------------------------------------------------------------

/**
 * Check for unknown fields in an object.
 * Returns a list of unknown field names found in the data.
 */
export function checkUnknownFields(data: object, knownFields: readonly string[]): string[] {
  const dataKeys = Object.keys(data);
  const knownSet = new Set(knownFields);
  return dataKeys.filter(key => !knownSet.has(key));
}

/**
 * Known fields for each chart type.
 */
export const KNOWN_FIELDS = {
  pie: ["title", "data"],
  pieItem: ["label", "value", "color"],
  bar: ["title", "xAxis", "yAxis", "data"],
  barItem: ["label", "value", "color"],
  groupedBar: ["title", "xAxis", "yAxis", "categories", "series"],
  groupedBarSeries: ["name", "values", "color"],
  scatter: ["title", "xAxis", "yAxis", "series"],
  scatterSeries: ["name", "points", "color"],
  scatterPoint: ["x", "y"],
  sankey: ["title", "nodes", "links"],
  sankeyNode: ["id", "label", "color"],
  sankeyLink: ["source", "target", "value"],
  quote: ["text", "authorName", "authorTitle", "company", "avatarPlaceholder", "style", "accentColor"],
} as const;

/**
 * Field similarity map for common mistakes (old field name -> correct field name).
 */
const FIELD_SUGGESTIONS: Record<string, string[]> = {
  attribution: ["authorName"],
  title: ["authorTitle"],  // In quote context, title likely means authorTitle
  author: ["authorName"],
  name: ["authorName"],
  role: ["authorTitle"],
  position: ["authorTitle"],
};

/**
 * Format unknown field warning with suggestions.
 */
export function formatUnknownFieldWarning(unknownFields: string[], chartType: keyof typeof KNOWN_FIELDS): string {
  const suggestions: string[] = [];
  for (const field of unknownFields) {
    const suggestion = FIELD_SUGGESTIONS[field];
    if (suggestion) {
      suggestions.push(...suggestion);
    }
  }

  let warning = `Warning: Unknown field(s) ignored: ${unknownFields.join(", ")}`;
  if (suggestions.length > 0) {
    const unique = [...new Set(suggestions)];
    warning += `\n  Did you mean: ${unique.join(", ")}?`;
  }
  return warning;
}

// ---------------------------------------------------------------------------
// Error formatting for CLI output
// ---------------------------------------------------------------------------

/**
 * Format a validation error with an example for actionable feedback.
 */
export function formatValidationError(err: ValidationError, example: string): string {
  return `Error: Invalid ${err.field}
  Expected: ${err.expected}
  Received: ${err.received}
  Example:  ${example}`;
}

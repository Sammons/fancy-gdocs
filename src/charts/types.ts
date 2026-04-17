/**
 * Chart type definitions for SVG generation
 */

/** Single data point for pie chart */
export interface PieSlice {
  label: string;
  value: number;
  color?: string;
}

/** Pie chart data format */
export interface PieChartData {
  title?: string;
  data: PieSlice[];
}

/** Common chart rendering options */
export interface ChartOptions {
  width?: number;
  height?: number;
}

/** Typography configuration */
export interface TypographyConfig {
  fontFamily: string;
  title: {
    fontSize: number;
    fontWeight: number;
    fill: string;
  };
  axis: {
    fontSize: number;
    fontWeight: number;
    fill: string;
  };
  label: {
    fontSize: number;
    fontWeight: number;
    fill: string;
  };
  legend: {
    fontSize: number;
    fontWeight: number;
    fill: string;
  };
}

/** Layout configuration */
export interface LayoutConfig {
  padding: number;
  titleMargin: number;
  legendSpacing: number;
  axisTickLength: number;
  gridLineColor: string;
  gridLineOpacity: number;
}

/** Default typography values */
export const TYPOGRAPHY: TypographyConfig = {
  fontFamily: "system-ui, -apple-system, sans-serif",
  title: {
    fontSize: 18,
    fontWeight: 600,
    fill: "#202124",
  },
  axis: {
    fontSize: 12,
    fontWeight: 400,
    fill: "#5F6368",
  },
  label: {
    fontSize: 11,
    fontWeight: 400,
    fill: "#202124",
  },
  legend: {
    fontSize: 12,
    fontWeight: 400,
    fill: "#3C4043",
  },
};

/** Default layout values */
export const LAYOUT: LayoutConfig = {
  padding: 20,
  titleMargin: 16,
  legendSpacing: 8,
  axisTickLength: 5,
  gridLineColor: "#E8EAED",
  gridLineOpacity: 0.8,
};

/** Type guard for PieChartData */
export function isPieChartData(data: unknown): data is PieChartData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.data)) return false;
  return obj.data.every(
    (item: unknown) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).label === "string" &&
      typeof (item as Record<string, unknown>).value === "number"
  );
}

/** Single data point for simple bar chart */
export interface BarDataPoint {
  label: string;
  value: number;
  color?: string;
}

/** Simple bar chart data format (single series) */
export interface BarChartData {
  title?: string;
  xAxis?: string;
  yAxis?: string;
  data: BarDataPoint[];
}

/** Series for grouped/stacked bar chart */
export interface BarSeries {
  name: string;
  values: number[];
  color?: string;
}

/** Grouped/Stacked bar chart data format (multiple series) */
export interface GroupedBarChartData {
  title?: string;
  xAxis?: string;
  yAxis?: string;
  categories: string[];
  series: BarSeries[];
}

/** Bar chart rendering options */
export interface BarChartOptions extends ChartOptions {
  horizontal?: boolean;
  stacked?: boolean;
}

/** Type guard for BarChartData (simple) */
export function isBarChartData(data: unknown): data is BarChartData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.data)) return false;
  return obj.data.every(
    (item: unknown) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).label === "string" &&
      typeof (item as Record<string, unknown>).value === "number"
  );
}

/** Type guard for GroupedBarChartData */
export function isGroupedBarChartData(data: unknown): data is GroupedBarChartData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.categories)) return false;
  if (!Array.isArray(obj.series)) return false;
  return obj.series.every(
    (item: unknown) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).name === "string" &&
      Array.isArray((item as Record<string, unknown>).values)
  );
}

/** Single point in a scatter plot */
export interface ScatterPoint {
  x: number;
  y: number;
}

/** Series for scatter plot */
export interface ScatterSeries {
  name: string;
  points: ScatterPoint[];
  color?: string;
}

/** Scatter plot data format */
export interface ScatterChartData {
  title?: string;
  xAxis?: string;
  yAxis?: string;
  series: ScatterSeries[];
}

/** Scatter chart rendering options */
export interface ScatterChartOptions extends ChartOptions {
  trendLine?: boolean;
}

/** Type guard for ScatterChartData */
export function isScatterChartData(data: unknown): data is ScatterChartData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.series)) return false;
  return obj.series.every(
    (item: unknown) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).name === "string" &&
      Array.isArray((item as Record<string, unknown>).points) &&
      ((item as Record<string, unknown>).points as unknown[]).every(
        (pt: unknown) =>
          typeof pt === "object" &&
          pt !== null &&
          typeof (pt as Record<string, unknown>).x === "number" &&
          typeof (pt as Record<string, unknown>).y === "number"
      )
  );
}

/** Node in a sankey diagram */
export interface SankeyNode {
  id: string;
  label: string;
  color?: string;
}

/** Link connecting two nodes in a sankey diagram */
export interface SankeyLink {
  source: string; // node id
  target: string; // node id
  value: number;
}

/** Sankey diagram data format */
export interface SankeyChartData {
  title?: string;
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/** Type guard for SankeyChartData */
export function isSankeyChartData(data: unknown): data is SankeyChartData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.nodes)) return false;
  if (!Array.isArray(obj.links)) return false;
  const validNodes = obj.nodes.every(
    (item: unknown) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).id === "string" &&
      typeof (item as Record<string, unknown>).label === "string"
  );
  const validLinks = obj.links.every(
    (item: unknown) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).source === "string" &&
      typeof (item as Record<string, unknown>).target === "string" &&
      typeof (item as Record<string, unknown>).value === "number"
  );
  return validNodes && validLinks;
}

/** Quote/testimonial card data format */
export interface QuoteChartData {
  text: string;                    // The quote itself
  authorName?: string;             // Person's name (was: attribution)
  authorTitle?: string;            // Person's job title (was: title)
  company?: string;                // Company name
  avatarPlaceholder?: boolean;     // Show circle placeholder for photo
  style?: "card" | "minimal" | "elegant";
  accentColor?: string;            // For decorative elements
}

/** Quote chart rendering options */
export interface QuoteChartOptions extends ChartOptions {
  style?: "card" | "minimal" | "elegant";
}

/** Type guard for QuoteChartData */
export function isQuoteChartData(data: unknown): data is QuoteChartData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.text !== "string") return false;
  if (obj.authorName !== undefined && typeof obj.authorName !== "string") return false;
  if (obj.authorTitle !== undefined && typeof obj.authorTitle !== "string") return false;
  if (obj.company !== undefined && typeof obj.company !== "string") return false;
  if (obj.avatarPlaceholder !== undefined && typeof obj.avatarPlaceholder !== "boolean") return false;
  if (obj.style !== undefined && !["card", "minimal", "elegant"].includes(obj.style as string)) return false;
  if (obj.accentColor !== undefined && typeof obj.accentColor !== "string") return false;
  return true;
}

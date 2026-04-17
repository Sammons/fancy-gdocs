/**
 * Scatter plot SVG generator
 */

import type { ScatterChartData, ScatterChartOptions, ScatterPoint } from "./types.ts";
import { TYPOGRAPHY, LAYOUT } from "./types.ts";
import { assignColors } from "./colors.ts";
import { svgDoc, svgGroup, svgCircle, svgText, svgLine } from "./utils.ts";

/** Default scatter chart dimensions */
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;

/** Scatter-specific layout constants */
const POINT_RADIUS = 5;
const POINT_STROKE_WIDTH = 1.5;
const AXIS_LABEL_PADDING = 8;
const Y_AXIS_WIDTH = 50;
const X_AXIS_HEIGHT = 30;
const LEGEND_ITEM_HEIGHT = 20;
const LEGEND_DOT_RADIUS = 5;
const LEGEND_DOT_GAP = 6;
const LEGEND_ITEM_GAP = 16;
const TREND_LINE_OPACITY = 0.5;
const TREND_LINE_DASH = "6,4";

/**
 * Calculate nice axis scale values with 10% padding beyond data range.
 */
function calculateNiceScale(
  dataMin: number,
  dataMax: number,
  targetTicks: number = 5
): { min: number; max: number; step: number; ticks: number[] } {
  // Add 10% padding
  const range = dataMax - dataMin;
  const padding = range * 0.1;
  let min = dataMin - padding;
  let max = dataMax + padding;

  // Handle edge case of single point or identical values
  if (max === min || range === 0) {
    min = dataMin - 1;
    max = dataMax + 1;
  }

  const roughStep = (max - min) / targetTicks;

  // Calculate magnitude
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalizedStep = roughStep / magnitude;

  // Choose nice step: 1, 2, 5, or 10
  let niceStep: number;
  if (normalizedStep <= 1) {
    niceStep = 1;
  } else if (normalizedStep <= 2) {
    niceStep = 2;
  } else if (normalizedStep <= 5) {
    niceStep = 5;
  } else {
    niceStep = 10;
  }
  niceStep *= magnitude;

  // Calculate nice min/max
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;

  // Generate tick values
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + niceStep * 0.5; v += niceStep) {
    ticks.push(Math.round(v * 1e10) / 1e10); // Avoid floating point issues
  }

  return { min: niceMin, max: niceMax, step: niceStep, ticks };
}

/**
 * Format tick value for display.
 */
function formatTickValue(value: number): string {
  if (Math.abs(value) >= 1e6) {
    return (value / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (Math.abs(value) >= 1e3) {
    return (value / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  }
  // Handle small decimals
  if (value !== 0 && Math.abs(value) < 1) {
    return value.toFixed(2).replace(/\.?0+$/, "");
  }
  return value.toString();
}

/**
 * Calculate linear regression coefficients (y = mx + b).
 * Returns { m: slope, b: intercept } or null if calculation not possible.
 */
export function linearRegression(
  points: ScatterPoint[]
): { m: number; b: number } | null {
  if (points.length < 2) {
    return null;
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denominator = n * sumXX - sumX * sumX;

  // Check for collinear points on vertical line (denominator = 0)
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  const m = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;

  return { m, b };
}

/**
 * Generate an SVG scatter plot from the given data.
 */
export function generateScatter(
  data: ScatterChartData,
  opts: ScatterChartOptions = {}
): string {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const showTrendLine = opts.trendLine ?? false;

  // Assign colors to series
  const coloredSeries = assignColors(data.series);

  // Calculate chart area
  const hasTitle = !!data.title;
  const titleHeight = hasTitle ? TYPOGRAPHY.title.fontSize + LAYOUT.titleMargin : 0;
  const hasLegend = coloredSeries.length > 1;
  const legendHeight = hasLegend ? LEGEND_ITEM_HEIGHT + LAYOUT.legendSpacing : 0;

  // Axis label heights
  const hasXAxisLabel = !!data.xAxis;
  const hasYAxisLabel = !!data.yAxis;
  const xAxisLabelHeight = hasXAxisLabel ? TYPOGRAPHY.axis.fontSize + AXIS_LABEL_PADDING : 0;
  const yAxisLabelWidth = hasYAxisLabel ? TYPOGRAPHY.axis.fontSize + AXIS_LABEL_PADDING : 0;

  // Chart plot area
  const plotLeft = LAYOUT.padding + Y_AXIS_WIDTH + yAxisLabelWidth;
  const plotTop = LAYOUT.padding + titleHeight;
  const plotRight = width - LAYOUT.padding;
  const plotBottom = height - LAYOUT.padding - X_AXIS_HEIGHT - xAxisLabelHeight - legendHeight;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Find data bounds across all series
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const series of coloredSeries) {
    for (const point of series.points) {
      xMin = Math.min(xMin, point.x);
      xMax = Math.max(xMax, point.x);
      yMin = Math.min(yMin, point.y);
      yMax = Math.max(yMax, point.y);
    }
  }

  // Handle edge case: no points
  if (!isFinite(xMin)) {
    xMin = 0;
    xMax = 100;
    yMin = 0;
    yMax = 100;
  }

  const xScale = calculateNiceScale(xMin, xMax);
  const yScale = calculateNiceScale(yMin, yMax);

  const xRange = xScale.max - xScale.min;
  const yRange = yScale.max - yScale.min;

  // Build SVG elements
  const elements: string[] = [];

  // Title
  if (hasTitle && data.title) {
    elements.push(
      svgGroup(
        [
          svgText(data.title, width / 2, LAYOUT.padding + TYPOGRAPHY.title.fontSize, {
            textAnchor: "middle",
            fontSize: TYPOGRAPHY.title.fontSize,
            fontWeight: TYPOGRAPHY.title.fontWeight,
            fontFamily: TYPOGRAPHY.fontFamily,
            fill: TYPOGRAPHY.title.fill,
          }),
        ],
        undefined,
        "chart-title"
      )
    );
  }

  // Grid lines (both axes)
  const gridElements: string[] = [];
  const axisElements: string[] = [];

  // X-axis grid lines and ticks
  for (const tick of xScale.ticks) {
    const x = plotLeft + ((tick - xScale.min) / xRange) * plotWidth;
    gridElements.push(
      svgLine(x, plotTop, x, plotBottom, {
        stroke: LAYOUT.gridLineColor,
        strokeWidth: 1,
      })
    );
    axisElements.push(
      svgText(formatTickValue(tick), x, plotBottom + TYPOGRAPHY.axis.fontSize + 4, {
        textAnchor: "middle",
        fontSize: TYPOGRAPHY.axis.fontSize,
        fontWeight: TYPOGRAPHY.axis.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: TYPOGRAPHY.axis.fill,
      })
    );
  }

  // Y-axis grid lines and ticks
  for (const tick of yScale.ticks) {
    const y = plotBottom - ((tick - yScale.min) / yRange) * plotHeight;
    gridElements.push(
      svgLine(plotLeft, y, plotRight, y, {
        stroke: LAYOUT.gridLineColor,
        strokeWidth: 1,
      })
    );
    axisElements.push(
      svgText(formatTickValue(tick), plotLeft - 8, y, {
        textAnchor: "end",
        dominantBaseline: "middle",
        fontSize: TYPOGRAPHY.axis.fontSize,
        fontWeight: TYPOGRAPHY.axis.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: TYPOGRAPHY.axis.fill,
      })
    );
  }

  elements.push(svgGroup(gridElements, undefined, "chart-grid"));

  // Trend lines (render before points so points appear on top)
  if (showTrendLine) {
    const trendElements: string[] = [];
    for (const series of coloredSeries) {
      const regression = linearRegression(series.points);
      if (regression) {
        // Calculate line endpoints at x scale boundaries
        const x1 = xScale.min;
        const y1 = regression.m * x1 + regression.b;
        const x2 = xScale.max;
        const y2 = regression.m * x2 + regression.b;

        // Clip to y scale
        const clipY1 = Math.max(yScale.min, Math.min(yScale.max, y1));
        const clipY2 = Math.max(yScale.min, Math.min(yScale.max, y2));

        // Convert to SVG coordinates
        const svgX1 = plotLeft + ((x1 - xScale.min) / xRange) * plotWidth;
        const svgY1 = plotBottom - ((clipY1 - yScale.min) / yRange) * plotHeight;
        const svgX2 = plotLeft + ((x2 - xScale.min) / xRange) * plotWidth;
        const svgY2 = plotBottom - ((clipY2 - yScale.min) / yRange) * plotHeight;

        trendElements.push(
          svgLine(svgX1, svgY1, svgX2, svgY2, {
            stroke: series.color,
            strokeWidth: 2,
            strokeDasharray: TREND_LINE_DASH,
          }).replace("/>", ` opacity="${TREND_LINE_OPACITY}"/>`)
        );
      }
    }
    if (trendElements.length > 0) {
      elements.push(svgGroup(trendElements, undefined, "chart-trend-lines"));
    }
  }

  // Points
  const pointElements: string[] = [];
  for (const series of coloredSeries) {
    for (const point of series.points) {
      const cx = plotLeft + ((point.x - xScale.min) / xRange) * plotWidth;
      const cy = plotBottom - ((point.y - yScale.min) / yRange) * plotHeight;
      pointElements.push(
        svgCircle(cx, cy, POINT_RADIUS, {
          fill: series.color,
          stroke: "#FFFFFF",
          strokeWidth: POINT_STROKE_WIDTH,
        })
      );
    }
  }
  elements.push(svgGroup(pointElements, undefined, "chart-points"));

  // Axis elements
  elements.push(svgGroup(axisElements, undefined, "chart-axis"));

  // Axis labels
  if (hasXAxisLabel && data.xAxis) {
    const labelY = height - LAYOUT.padding - legendHeight - xAxisLabelHeight / 2;
    elements.push(
      svgText(data.xAxis, width / 2, labelY, {
        textAnchor: "middle",
        fontSize: TYPOGRAPHY.axis.fontSize,
        fontWeight: TYPOGRAPHY.axis.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: TYPOGRAPHY.axis.fill,
      })
    );
  }

  if (hasYAxisLabel && data.yAxis) {
    const labelX = LAYOUT.padding + TYPOGRAPHY.axis.fontSize;
    const labelY = plotTop + plotHeight / 2;
    elements.push(
      svgGroup(
        [
          svgText(data.yAxis, 0, 0, {
            textAnchor: "middle",
            fontSize: TYPOGRAPHY.axis.fontSize,
            fontWeight: TYPOGRAPHY.axis.fontWeight,
            fontFamily: TYPOGRAPHY.fontFamily,
            fill: TYPOGRAPHY.axis.fill,
          }),
        ],
        `translate(${labelX}, ${labelY}) rotate(-90)`
      )
    );
  }

  // Legend (only for multiple series)
  if (hasLegend) {
    const legendY = height - LAYOUT.padding - LEGEND_ITEM_HEIGHT / 2;
    const legendItems: string[] = [];

    // Calculate total legend width for centering
    let totalLegendWidth = 0;
    const itemWidths: number[] = [];
    for (const series of coloredSeries) {
      const textWidth = series.name.length * 7;
      const itemWidth = LEGEND_DOT_RADIUS * 2 + LEGEND_DOT_GAP + textWidth;
      itemWidths.push(itemWidth);
      totalLegendWidth += itemWidth + LEGEND_ITEM_GAP;
    }
    totalLegendWidth -= LEGEND_ITEM_GAP;

    let legendX = (width - totalLegendWidth) / 2;

    for (let i = 0; i < coloredSeries.length; i++) {
      const series = coloredSeries[i];
      legendItems.push(
        svgCircle(legendX + LEGEND_DOT_RADIUS, legendY, LEGEND_DOT_RADIUS, {
          fill: series.color,
        })
      );
      legendItems.push(
        svgText(series.name, legendX + LEGEND_DOT_RADIUS * 2 + LEGEND_DOT_GAP, legendY, {
          textAnchor: "start",
          dominantBaseline: "middle",
          fontSize: TYPOGRAPHY.legend.fontSize,
          fontWeight: TYPOGRAPHY.legend.fontWeight,
          fontFamily: TYPOGRAPHY.fontFamily,
          fill: TYPOGRAPHY.legend.fill,
        })
      );
      legendX += itemWidths[i] + LEGEND_ITEM_GAP;
    }

    elements.push(svgGroup(legendItems, undefined, "chart-legend"));
  }

  return svgDoc(elements.join("\n"), width, height, data.title);
}

/** Re-export scale calculation for testing */
export { calculateNiceScale };

/**
 * Bar chart SVG generator
 */

import type { BarChartData, GroupedBarChartData, BarChartOptions } from "./types.ts";
import { TYPOGRAPHY, LAYOUT } from "./types.ts";
import { assignColors, PALETTE } from "./colors.ts";
import { svgDoc, svgGroup, svgRect, svgText, svgLine } from "./utils.ts";

/** Default bar chart dimensions */
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;

/** Bar-specific layout constants */
const BAR_CORNER_RADIUS = 2;
const BAR_GAP_RATIO = 0.2;
const GROUP_GAP_RATIO = 0.1;
const AXIS_LABEL_PADDING = 8;
const Y_AXIS_WIDTH = 50;
const X_AXIS_HEIGHT = 30;
const LEGEND_ITEM_HEIGHT = 20;
const LEGEND_SWATCH_SIZE = 12;
const LEGEND_SWATCH_GAP = 6;
const LEGEND_ITEM_GAP = 16;

/**
 * Calculate nice axis scale values (round to nearest 10, 100, etc.)
 */
function calculateNiceScale(
  min: number,
  max: number,
  targetTicks: number = 5
): { min: number; max: number; step: number; ticks: number[] } {
  if (max === min) {
    max = min + 10;
  }

  const range = max - min;
  const roughStep = range / targetTicks;

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
  return value.toString();
}

/**
 * Check if data is grouped bar chart format.
 */
function isGrouped(data: BarChartData | GroupedBarChartData): data is GroupedBarChartData {
  return "series" in data && Array.isArray(data.series);
}

/**
 * Generate an SVG bar chart from the given data.
 */
export function generateBar(
  data: BarChartData | GroupedBarChartData,
  opts: BarChartOptions = {}
): string {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const horizontal = opts.horizontal ?? false;
  const stacked = opts.stacked ?? false;

  // Determine if grouped/stacked
  const grouped = isGrouped(data);

  // Calculate chart area
  const hasTitle = !!data.title;
  const titleHeight = hasTitle ? TYPOGRAPHY.title.fontSize + LAYOUT.titleMargin : 0;
  const hasLegend = grouped;
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

  // Get categories and values
  let categories: string[];
  let seriesData: { name: string; values: number[]; color: string }[];
  let perBarColors: string[] | null = null; // For simple bar charts with per-bar colors

  if (grouped) {
    categories = data.categories;
    seriesData = assignColors(data.series);
  } else {
    categories = data.data.map((d) => d.label);
    const coloredData = assignColors(data.data);
    // Track per-bar colors for simple charts
    perBarColors = coloredData.map((d) => d.color);
    seriesData = [
      {
        name: "Value",
        values: coloredData.map((d) => d.value),
        color: coloredData[0]?.color ?? PALETTE[0],
      },
    ];
  }

  // Calculate min/max values
  let minValue = 0; // Always include 0 for bar charts
  let maxValue = 0;

  if (stacked && grouped) {
    // For stacked, sum values per category
    for (let i = 0; i < categories.length; i++) {
      const sum = seriesData.reduce((acc, s) => acc + (s.values[i] ?? 0), 0);
      maxValue = Math.max(maxValue, sum);
    }
  } else {
    // For simple or grouped, find max across all values
    for (const series of seriesData) {
      for (const v of series.values) {
        maxValue = Math.max(maxValue, v);
        minValue = Math.min(minValue, v);
      }
    }
  }

  // Ensure min is 0 for standard bar charts
  minValue = Math.min(0, minValue);

  const scale = calculateNiceScale(minValue, maxValue);

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

  // Grid lines and Y-axis
  const axisElements: string[] = [];
  const gridElements: string[] = [];

  if (horizontal) {
    // Horizontal mode: value axis is X, category axis is Y
    const valueRange = scale.max - scale.min;
    const categoryCount = categories.length;
    const barGroupHeight = plotHeight / categoryCount;
    const barHeight =
      barGroupHeight * (1 - BAR_GAP_RATIO) / (stacked ? 1 : seriesData.length);
    const groupPadding = barGroupHeight * BAR_GAP_RATIO / 2;

    // X-axis (value) ticks and grid
    for (const tick of scale.ticks) {
      const x = plotLeft + ((tick - scale.min) / valueRange) * plotWidth;
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

    // Y-axis (category) labels
    for (let i = 0; i < categories.length; i++) {
      const y = plotTop + groupPadding + i * barGroupHeight + barGroupHeight * (1 - BAR_GAP_RATIO) / 2;
      axisElements.push(
        svgText(categories[i], plotLeft - 8, y, {
          textAnchor: "end",
          dominantBaseline: "middle",
          fontSize: TYPOGRAPHY.axis.fontSize,
          fontWeight: TYPOGRAPHY.axis.fontWeight,
          fontFamily: TYPOGRAPHY.fontFamily,
          fill: TYPOGRAPHY.axis.fill,
        })
      );
    }

    // Draw bars
    const barElements: string[] = [];
    for (let catIndex = 0; catIndex < categories.length; catIndex++) {
      if (stacked) {
        let currentX = plotLeft;
        for (let seriesIndex = 0; seriesIndex < seriesData.length; seriesIndex++) {
          const series = seriesData[seriesIndex];
          const value = series.values[catIndex] ?? 0;
          const barWidth = (value / valueRange) * plotWidth;
          const y = plotTop + groupPadding + catIndex * barGroupHeight;
          const bh = barGroupHeight * (1 - BAR_GAP_RATIO);

          if (barWidth > 0) {
            barElements.push(
              svgRect(currentX, y, barWidth, bh, {
                fill: series.color,
                rx: seriesIndex === seriesData.length - 1 ? BAR_CORNER_RADIUS : 0,
                ry: seriesIndex === seriesData.length - 1 ? BAR_CORNER_RADIUS : 0,
              })
            );
          }
          currentX += barWidth;
        }
      } else {
        for (let seriesIndex = 0; seriesIndex < seriesData.length; seriesIndex++) {
          const series = seriesData[seriesIndex];
          const value = series.values[catIndex] ?? 0;
          const barWidth = ((value - scale.min) / valueRange) * plotWidth;
          const y =
            plotTop +
            groupPadding +
            catIndex * barGroupHeight +
            seriesIndex * barHeight +
            (grouped ? barHeight * GROUP_GAP_RATIO / 2 : 0);
          const bh = barHeight * (grouped ? 1 - GROUP_GAP_RATIO : 1);
          // Use per-bar color for simple charts, series color for grouped
          const fillColor = perBarColors ? perBarColors[catIndex] : series.color;

          if (barWidth > 0) {
            barElements.push(
              svgRect(plotLeft, y, barWidth, bh, {
                fill: fillColor,
                rx: BAR_CORNER_RADIUS,
                ry: BAR_CORNER_RADIUS,
              })
            );
          }
        }
      }
    }
    elements.push(svgGroup(barElements, undefined, "chart-bars"));
  } else {
    // Vertical mode: value axis is Y, category axis is X
    const valueRange = scale.max - scale.min;
    const categoryCount = categories.length;
    const barGroupWidth = plotWidth / categoryCount;
    const barWidth =
      barGroupWidth * (1 - BAR_GAP_RATIO) / (stacked ? 1 : seriesData.length);
    const groupPadding = barGroupWidth * BAR_GAP_RATIO / 2;

    // Y-axis (value) ticks and grid
    for (const tick of scale.ticks) {
      const y = plotBottom - ((tick - scale.min) / valueRange) * plotHeight;
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

    // X-axis (category) labels
    for (let i = 0; i < categories.length; i++) {
      const x = plotLeft + groupPadding + i * barGroupWidth + barGroupWidth * (1 - BAR_GAP_RATIO) / 2;
      axisElements.push(
        svgText(categories[i], x, plotBottom + TYPOGRAPHY.axis.fontSize + 4, {
          textAnchor: "middle",
          fontSize: TYPOGRAPHY.axis.fontSize,
          fontWeight: TYPOGRAPHY.axis.fontWeight,
          fontFamily: TYPOGRAPHY.fontFamily,
          fill: TYPOGRAPHY.axis.fill,
        })
      );
    }

    // Draw bars
    const barElements: string[] = [];
    for (let catIndex = 0; catIndex < categories.length; catIndex++) {
      if (stacked) {
        let currentY = plotBottom;
        for (let seriesIndex = 0; seriesIndex < seriesData.length; seriesIndex++) {
          const series = seriesData[seriesIndex];
          const value = series.values[catIndex] ?? 0;
          const barHeight = (value / valueRange) * plotHeight;
          const x = plotLeft + groupPadding + catIndex * barGroupWidth;
          const bw = barGroupWidth * (1 - BAR_GAP_RATIO);

          if (barHeight > 0) {
            barElements.push(
              svgRect(x, currentY - barHeight, bw, barHeight, {
                fill: series.color,
                rx: seriesIndex === seriesData.length - 1 ? BAR_CORNER_RADIUS : 0,
                ry: seriesIndex === seriesData.length - 1 ? BAR_CORNER_RADIUS : 0,
              })
            );
          }
          currentY -= barHeight;
        }
      } else {
        for (let seriesIndex = 0; seriesIndex < seriesData.length; seriesIndex++) {
          const series = seriesData[seriesIndex];
          const value = series.values[catIndex] ?? 0;
          const barHeight = ((value - scale.min) / valueRange) * plotHeight;
          const x =
            plotLeft +
            groupPadding +
            catIndex * barGroupWidth +
            seriesIndex * barWidth +
            (grouped ? barWidth * GROUP_GAP_RATIO / 2 : 0);
          const bw = barWidth * (grouped ? 1 - GROUP_GAP_RATIO : 1);
          // Use per-bar color for simple charts, series color for grouped
          const fillColor = perBarColors ? perBarColors[catIndex] : series.color;

          if (barHeight > 0) {
            barElements.push(
              svgRect(x, plotBottom - barHeight, bw, barHeight, {
                fill: fillColor,
                rx: BAR_CORNER_RADIUS,
                ry: BAR_CORNER_RADIUS,
              })
            );
          }
        }
      }
    }
    elements.push(svgGroup(barElements, undefined, "chart-bars"));
  }

  // Add grid and axis elements (grid first, so it's behind bars)
  elements.unshift(svgGroup(gridElements, undefined, "chart-grid"));
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

  // Legend (only for grouped/stacked)
  if (hasLegend) {
    const legendY = height - LAYOUT.padding - LEGEND_ITEM_HEIGHT / 2;
    const legendItems: string[] = [];

    // Calculate total legend width for centering
    let totalLegendWidth = 0;
    const itemWidths: number[] = [];
    for (const series of seriesData) {
      const textWidth = series.name.length * 7;
      const itemWidth = LEGEND_SWATCH_SIZE + LEGEND_SWATCH_GAP + textWidth;
      itemWidths.push(itemWidth);
      totalLegendWidth += itemWidth + LEGEND_ITEM_GAP;
    }
    totalLegendWidth -= LEGEND_ITEM_GAP;

    let legendX = (width - totalLegendWidth) / 2;

    for (let i = 0; i < seriesData.length; i++) {
      const series = seriesData[i];
      legendItems.push(
        svgRect(
          legendX,
          legendY - LEGEND_SWATCH_SIZE / 2,
          LEGEND_SWATCH_SIZE,
          LEGEND_SWATCH_SIZE,
          {
            fill: series.color,
            rx: 2,
            ry: 2,
          }
        )
      );
      legendItems.push(
        svgText(series.name, legendX + LEGEND_SWATCH_SIZE + LEGEND_SWATCH_GAP, legendY, {
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

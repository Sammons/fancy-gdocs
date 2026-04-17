/**
 * Pie chart SVG generator
 */

import type { PieChartData, ChartOptions } from "./types.ts";
import { TYPOGRAPHY, LAYOUT } from "./types.ts";
import { assignPieColors } from "./colors.ts";
import {
  svgDoc,
  svgGroup,
  svgPath,
  svgText,
  svgLine,
  svgRect,
  polarToCartesian,
  describeArc,
} from "./utils.ts";

/** Default pie chart dimensions */
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 400;

/** Pie-specific layout constants */
const PIE_STROKE_WIDTH = 2;
const PIE_STROKE_COLOR = "#FFFFFF";
const LABEL_OFFSET = 20;
const LEADER_LINE_LENGTH = 15;
const LEGEND_ITEM_HEIGHT = 20;
const LEGEND_SWATCH_SIZE = 12;
const LEGEND_SWATCH_GAP = 6;
const LEGEND_ITEM_GAP = 16;

/**
 * Generate an SVG pie chart from the given data.
 */
export function generatePie(data: PieChartData, opts: ChartOptions = {}): string {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;

  // Calculate chart area accounting for title and legend
  const hasTitle = !!data.title;
  const titleHeight = hasTitle ? TYPOGRAPHY.title.fontSize + LAYOUT.titleMargin : 0;
  const legendHeight = LEGEND_ITEM_HEIGHT + LAYOUT.padding;

  // Calculate pie center and radius
  const chartAreaHeight = height - titleHeight - legendHeight - LAYOUT.padding * 2;
  const chartAreaWidth = width - LAYOUT.padding * 2;
  const centerX = width / 2;
  const centerY = titleHeight + LAYOUT.padding + chartAreaHeight / 2;
  const radius = Math.min(chartAreaWidth, chartAreaHeight) / 2 - LABEL_OFFSET - LEADER_LINE_LENGTH;

  // Assign colors to slices without explicit colors
  const slices = assignPieColors(data.data);

  // Calculate total for percentage computation
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return svgDoc(
      svgText("No data", width / 2, height / 2, {
        textAnchor: "middle",
        fontSize: TYPOGRAPHY.label.fontSize,
        fill: TYPOGRAPHY.label.fill,
      }),
      width,
      height,
      data.title
    );
  }

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

  // Pie slices
  const sliceElements: string[] = [];
  const labelElements: string[] = [];
  let currentAngle = -Math.PI / 2; // Start at top

  for (const slice of slices) {
    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;

    // Draw slice
    const pathD = describeArc(centerX, centerY, radius, currentAngle, endAngle);
    sliceElements.push(
      svgPath(pathD, {
        fill: slice.color,
        stroke: PIE_STROKE_COLOR,
        strokeWidth: PIE_STROKE_WIDTH,
      })
    );

    // Calculate label position (outside the pie)
    const midAngle = currentAngle + sliceAngle / 2;
    const labelRadius = radius + LEADER_LINE_LENGTH + LABEL_OFFSET;
    const labelPos = polarToCartesian(centerX, centerY, labelRadius, midAngle);

    // Leader line endpoints
    const innerLinePos = polarToCartesian(centerX, centerY, radius + 5, midAngle);
    const outerLinePos = polarToCartesian(centerX, centerY, radius + LEADER_LINE_LENGTH, midAngle);

    // Draw leader line
    labelElements.push(
      svgLine(innerLinePos.x, innerLinePos.y, outerLinePos.x, outerLinePos.y, {
        stroke: "#9E9E9E",
        strokeWidth: 1,
      })
    );

    // Determine text anchor based on position (left or right of center)
    const textAnchor = labelPos.x > centerX ? "start" : "end";
    const percentage = ((slice.value / total) * 100).toFixed(1);

    labelElements.push(
      svgText(`${slice.label} (${percentage}%)`, labelPos.x, labelPos.y, {
        textAnchor,
        dominantBaseline: "middle",
        fontSize: TYPOGRAPHY.label.fontSize,
        fontWeight: TYPOGRAPHY.label.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: TYPOGRAPHY.label.fill,
      })
    );

    currentAngle = endAngle;
  }

  elements.push(svgGroup(sliceElements, undefined, "chart-slices"));
  elements.push(svgGroup(labelElements, undefined, "chart-labels"));

  // Legend (horizontal, below the chart)
  const legendY = height - LAYOUT.padding - LEGEND_ITEM_HEIGHT / 2;
  const legendItems: string[] = [];

  // Calculate total legend width for centering
  let totalLegendWidth = 0;
  const itemWidths: number[] = [];
  for (const slice of slices) {
    // Approximate text width (rough estimate: 7px per character)
    const textWidth = slice.label.length * 7;
    const itemWidth = LEGEND_SWATCH_SIZE + LEGEND_SWATCH_GAP + textWidth;
    itemWidths.push(itemWidth);
    totalLegendWidth += itemWidth + LEGEND_ITEM_GAP;
  }
  totalLegendWidth -= LEGEND_ITEM_GAP; // Remove trailing gap

  let legendX = (width - totalLegendWidth) / 2;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    // Color swatch
    legendItems.push(
      svgRect(legendX, legendY - LEGEND_SWATCH_SIZE / 2, LEGEND_SWATCH_SIZE, LEGEND_SWATCH_SIZE, {
        fill: slice.color,
        rx: 2,
        ry: 2,
      })
    );
    // Label text
    legendItems.push(
      svgText(slice.label, legendX + LEGEND_SWATCH_SIZE + LEGEND_SWATCH_GAP, legendY, {
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

  return svgDoc(elements.join("\n"), width, height, data.title);
}

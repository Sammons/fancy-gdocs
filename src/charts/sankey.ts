/**
 * Sankey diagram SVG generator
 */

import type { SankeyChartData, SankeyNode, SankeyLink, ChartOptions } from "./types.ts";
import { TYPOGRAPHY, LAYOUT } from "./types.ts";
import { assignColors } from "./colors.ts";
import { svgDoc, svgGroup, svgPath, svgText, svgRect } from "./utils.ts";

/** Default sankey chart dimensions */
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 500;

/** Sankey-specific layout constants */
const NODE_WIDTH = 20;
const NODE_PADDING = 10;
const LINK_OPACITY = 0.5;
const MIN_LINK_WIDTH = 2;

/** Internal node with computed layout */
interface ComputedNode {
  id: string;
  label: string;
  color: string;
  depth: number;
  x: number;
  y: number;
  height: number;
  sourceTotal: number; // total value of outgoing links
  targetTotal: number; // total value of incoming links
  throughput: number; // max of source/target totals
  sourceOffset: number; // current y offset for source links
  targetOffset: number; // current y offset for target links
}

/** Internal link with computed positions */
interface ComputedLink {
  source: ComputedNode;
  target: ComputedNode;
  value: number;
  width: number;
  sourceY: number;
  targetY: number;
}

/**
 * Compute node depths via modified BFS from source nodes.
 * Sources (nodes with no incoming links) start at depth 0.
 * Uses longest path to determine depth (not first visit).
 * Handles circular references by capping iterations.
 */
function computeNodeDepths(
  nodes: Map<string, ComputedNode>,
  links: SankeyLink[]
): number {
  // Build adjacency list
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const node of nodes.values()) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
    node.depth = -1; // Mark as unvisited
  }

  for (const link of links) {
    if (nodes.has(link.source) && nodes.has(link.target)) {
      outgoing.get(link.source)!.push(link.target);
      incoming.get(link.target)!.push(link.source);
    }
  }

  // Find source nodes (no incoming links)
  const sources: string[] = [];
  for (const [id, incomingList] of incoming) {
    if (incomingList.length === 0) {
      sources.push(id);
    }
  }

  // If no sources found (circular), pick first node
  if (sources.length === 0 && nodes.size > 0) {
    const firstKey = nodes.keys().next().value;
    if (firstKey) sources.push(firstKey);
  }

  // BFS to assign depths - use longest path (update depth if new path is longer)
  const queue: Array<{ id: string; depth: number }> = sources.map((id) => ({ id, depth: 0 }));
  let maxDepth = 0;
  const maxIterations = nodes.size * links.length + 1; // Cap to prevent infinite loops
  let iterations = 0;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const { id, depth } = queue.shift()!;
    const node = nodes.get(id)!;

    // Only process if this path is longer than any previous path
    if (depth <= node.depth) continue;

    node.depth = depth;
    maxDepth = Math.max(maxDepth, depth);

    // Queue all outgoing neighbors with incremented depth
    for (const targetId of outgoing.get(id) || []) {
      const targetNode = nodes.get(targetId);
      if (targetNode && depth + 1 > targetNode.depth) {
        queue.push({ id: targetId, depth: depth + 1 });
      }
    }
  }

  // Assign remaining unvisited nodes to depth 0
  for (const node of nodes.values()) {
    if (node.depth < 0) {
      node.depth = 0;
    }
  }

  return maxDepth;
}

/**
 * Compute node throughput (max of incoming/outgoing link values).
 */
function computeThroughput(nodes: Map<string, ComputedNode>, links: SankeyLink[]): void {
  for (const node of nodes.values()) {
    node.sourceTotal = 0;
    node.targetTotal = 0;
  }

  for (const link of links) {
    const source = nodes.get(link.source);
    const target = nodes.get(link.target);
    if (source && target) {
      source.sourceTotal += link.value;
      target.targetTotal += link.value;
    }
  }

  for (const node of nodes.values()) {
    node.throughput = Math.max(node.sourceTotal, node.targetTotal);
  }
}

/**
 * Position nodes vertically within their columns.
 * Nodes are stacked based on their throughput with padding.
 */
function positionNodes(
  nodes: Map<string, ComputedNode>,
  maxDepth: number,
  plotLeft: number,
  plotWidth: number,
  plotTop: number,
  plotHeight: number
): void {
  // Group nodes by depth
  const columns = new Map<number, ComputedNode[]>();
  for (let d = 0; d <= maxDepth; d++) {
    columns.set(d, []);
  }
  for (const node of nodes.values()) {
    columns.get(node.depth)!.push(node);
  }

  // Calculate column x positions
  const columnWidth = maxDepth > 0 ? plotWidth / maxDepth : plotWidth;

  // Position nodes within each column
  for (const [depth, columnNodes] of columns) {
    if (columnNodes.length === 0) continue;

    // Calculate x position for column
    const x = plotLeft + (depth * columnWidth) - (depth > 0 ? NODE_WIDTH / 2 : 0);

    // Calculate total throughput and required height
    const totalThroughput = columnNodes.reduce((sum, n) => sum + n.throughput, 0);
    const totalPadding = (columnNodes.length - 1) * NODE_PADDING;
    const availableHeight = plotHeight - totalPadding;

    // Sort by throughput for better layout
    columnNodes.sort((a, b) => b.throughput - a.throughput);

    // Position each node
    let currentY = plotTop;
    for (const node of columnNodes) {
      node.x = x;
      node.y = currentY;
      // Height proportional to throughput, but ensure minimum
      node.height =
        totalThroughput > 0
          ? Math.max((node.throughput / totalThroughput) * availableHeight, MIN_LINK_WIDTH * 2)
          : availableHeight / columnNodes.length;
      currentY += node.height + NODE_PADDING;
    }

    // Center the column if there's extra space
    const usedHeight = currentY - plotTop - NODE_PADDING;
    const extraSpace = plotHeight - usedHeight;
    if (extraSpace > 0) {
      const offset = extraSpace / 2;
      for (const node of columnNodes) {
        node.y += offset;
      }
    }
  }
}

/**
 * Compute link positions and widths.
 */
function computeLinks(
  nodes: Map<string, ComputedNode>,
  links: SankeyLink[]
): ComputedLink[] {
  // Reset offsets
  for (const node of nodes.values()) {
    node.sourceOffset = 0;
    node.targetOffset = 0;
  }

  const computed: ComputedLink[] = [];

  // Sort links by source then target for consistent ordering
  const sortedLinks = [...links].sort((a, b) => {
    const sourceA = nodes.get(a.source);
    const sourceB = nodes.get(b.source);
    const targetA = nodes.get(a.target);
    const targetB = nodes.get(b.target);
    if (!sourceA || !sourceB || !targetA || !targetB) return 0;
    if (sourceA.y !== sourceB.y) return sourceA.y - sourceB.y;
    return targetA.y - targetB.y;
  });

  for (const link of sortedLinks) {
    const source = nodes.get(link.source);
    const target = nodes.get(link.target);

    if (!source || !target) continue;
    if (source.depth >= target.depth) continue; // Skip back-links

    // Calculate link width proportional to value
    const sourceRatio = source.sourceTotal > 0 ? link.value / source.sourceTotal : 0;
    const targetRatio = target.targetTotal > 0 ? link.value / target.targetTotal : 0;

    const sourceWidth = sourceRatio * source.height;
    const targetWidth = targetRatio * target.height;
    const width = Math.max(Math.min(sourceWidth, targetWidth), MIN_LINK_WIDTH);

    // Calculate y positions
    const sourceY = source.y + source.sourceOffset + width / 2;
    const targetY = target.y + target.targetOffset + width / 2;

    // Update offsets
    source.sourceOffset += width;
    target.targetOffset += width;

    computed.push({
      source,
      target,
      value: link.value,
      width,
      sourceY,
      targetY,
    });
  }

  return computed;
}

/**
 * Generate cubic bezier path for a link.
 */
function generateLinkPath(link: ComputedLink): string {
  const x0 = link.source.x + NODE_WIDTH;
  const y0 = link.sourceY;
  const x1 = link.target.x;
  const y1 = link.targetY;

  // Control points for smooth horizontal bezier
  const curvature = 0.5;
  const xi = (x1 - x0) * curvature;

  const halfWidth = link.width / 2;

  // Path: top edge, right curve, bottom edge, left curve
  return [
    `M ${x0} ${y0 - halfWidth}`,
    `C ${x0 + xi} ${y0 - halfWidth}, ${x1 - xi} ${y1 - halfWidth}, ${x1} ${y1 - halfWidth}`,
    `L ${x1} ${y1 + halfWidth}`,
    `C ${x1 - xi} ${y1 + halfWidth}, ${x0 + xi} ${y0 + halfWidth}, ${x0} ${y0 + halfWidth}`,
    `Z`,
  ].join(" ");
}

/**
 * Generate an SVG sankey diagram from the given data.
 */
export function generateSankey(data: SankeyChartData, opts: ChartOptions = {}): string {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;

  // Handle empty data
  if (data.nodes.length === 0) {
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

  // Assign colors to nodes
  const coloredNodes = assignColors(data.nodes);

  // Create node map
  const nodes = new Map<string, ComputedNode>();
  for (const node of coloredNodes) {
    nodes.set(node.id, {
      id: node.id,
      label: node.label,
      color: node.color,
      depth: 0,
      x: 0,
      y: 0,
      height: 0,
      sourceTotal: 0,
      targetTotal: 0,
      throughput: 0,
      sourceOffset: 0,
      targetOffset: 0,
    });
  }

  // Calculate chart area
  const hasTitle = !!data.title;
  const titleHeight = hasTitle ? TYPOGRAPHY.title.fontSize + LAYOUT.titleMargin : 0;
  const labelPadding = 80; // Space for node labels

  const plotLeft = LAYOUT.padding + labelPadding;
  const plotTop = LAYOUT.padding + titleHeight;
  const plotRight = width - LAYOUT.padding - labelPadding;
  const plotBottom = height - LAYOUT.padding;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Compute layout
  const maxDepth = computeNodeDepths(nodes, data.links);
  computeThroughput(nodes, data.links);
  positionNodes(nodes, maxDepth, plotLeft, plotWidth, plotTop, plotHeight);

  // Compute links
  const computedLinks = computeLinks(nodes, data.links);

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

  // Links (render first so nodes appear on top)
  const linkElements: string[] = [];
  for (const link of computedLinks) {
    const pathD = generateLinkPath(link);
    linkElements.push(
      svgPath(pathD, {
        fill: link.source.color,
        opacity: LINK_OPACITY,
      })
    );
  }
  elements.push(svgGroup(linkElements, undefined, "chart-links"));

  // Nodes
  const nodeElements: string[] = [];
  const labelElements: string[] = [];

  for (const node of nodes.values()) {
    // Node rectangle
    nodeElements.push(
      svgRect(node.x, node.y, NODE_WIDTH, node.height, {
        fill: node.color,
      })
    );

    // Label - position based on column
    const isLeftColumn = node.depth === 0;
    const labelX = isLeftColumn ? node.x - 8 : node.x + NODE_WIDTH + 8;
    const labelY = node.y + node.height / 2;
    const textAnchor = isLeftColumn ? "end" : "start";

    labelElements.push(
      svgText(node.label, labelX, labelY, {
        textAnchor,
        dominantBaseline: "middle",
        fontSize: TYPOGRAPHY.label.fontSize,
        fontWeight: TYPOGRAPHY.label.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: TYPOGRAPHY.label.fill,
      })
    );
  }

  elements.push(svgGroup(nodeElements, undefined, "chart-nodes"));
  elements.push(svgGroup(labelElements, undefined, "chart-labels"));

  return svgDoc(elements.join("\n"), width, height, data.title);
}

/** Export layout computation for testing */
export { computeNodeDepths, computeThroughput };

/**
 * SVG helper functions for chart generation
 */

/** Text element options */
export interface TextOptions {
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  fill?: string;
  textAnchor?: "start" | "middle" | "end";
  dominantBaseline?: "auto" | "middle" | "hanging" | "central";
}

/** Path element options */
export interface PathOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

/** Circle element options */
export interface CircleOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/** Rectangle element options */
export interface RectOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  ry?: number;
}

/** Line element options */
export interface LineOptions {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

/**
 * Escape XML special characters for safe embedding in SVG.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate SVG text element.
 */
export function svgText(content: string, x: number, y: number, opts: TextOptions = {}): string {
  const attrs: string[] = [`x="${x}"`, `y="${y}"`];
  if (opts.fontSize) attrs.push(`font-size="${opts.fontSize}"`);
  if (opts.fontWeight) attrs.push(`font-weight="${opts.fontWeight}"`);
  if (opts.fontFamily) attrs.push(`font-family="${escapeXml(opts.fontFamily)}"`);
  if (opts.fill) attrs.push(`fill="${opts.fill}"`);
  if (opts.textAnchor) attrs.push(`text-anchor="${opts.textAnchor}"`);
  if (opts.dominantBaseline) attrs.push(`dominant-baseline="${opts.dominantBaseline}"`);
  return `<text ${attrs.join(" ")}>${escapeXml(content)}</text>`;
}

/**
 * Generate SVG path element.
 */
export function svgPath(d: string, opts: PathOptions = {}): string {
  const attrs: string[] = [`d="${d}"`];
  if (opts.fill !== undefined) attrs.push(`fill="${opts.fill}"`);
  if (opts.stroke) attrs.push(`stroke="${opts.stroke}"`);
  if (opts.strokeWidth !== undefined) attrs.push(`stroke-width="${opts.strokeWidth}"`);
  if (opts.opacity !== undefined) attrs.push(`opacity="${opts.opacity}"`);
  return `<path ${attrs.join(" ")}/>`;
}

/**
 * Generate SVG circle element.
 */
export function svgCircle(cx: number, cy: number, r: number, opts: CircleOptions = {}): string {
  const attrs: string[] = [`cx="${cx}"`, `cy="${cy}"`, `r="${r}"`];
  if (opts.fill) attrs.push(`fill="${opts.fill}"`);
  if (opts.stroke) attrs.push(`stroke="${opts.stroke}"`);
  if (opts.strokeWidth !== undefined) attrs.push(`stroke-width="${opts.strokeWidth}"`);
  return `<circle ${attrs.join(" ")}/>`;
}

/**
 * Generate SVG rectangle element.
 */
export function svgRect(
  x: number,
  y: number,
  width: number,
  height: number,
  opts: RectOptions = {}
): string {
  const attrs: string[] = [
    `x="${x}"`,
    `y="${y}"`,
    `width="${width}"`,
    `height="${height}"`,
  ];
  if (opts.fill) attrs.push(`fill="${opts.fill}"`);
  if (opts.stroke) attrs.push(`stroke="${opts.stroke}"`);
  if (opts.strokeWidth !== undefined) attrs.push(`stroke-width="${opts.strokeWidth}"`);
  if (opts.rx !== undefined) attrs.push(`rx="${opts.rx}"`);
  if (opts.ry !== undefined) attrs.push(`ry="${opts.ry}"`);
  return `<rect ${attrs.join(" ")}/>`;
}

/**
 * Generate SVG line element.
 */
export function svgLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: LineOptions = {}
): string {
  const attrs: string[] = [
    `x1="${x1}"`,
    `y1="${y1}"`,
    `x2="${x2}"`,
    `y2="${y2}"`,
  ];
  if (opts.stroke) attrs.push(`stroke="${opts.stroke}"`);
  if (opts.strokeWidth !== undefined) attrs.push(`stroke-width="${opts.strokeWidth}"`);
  if (opts.strokeDasharray) attrs.push(`stroke-dasharray="${opts.strokeDasharray}"`);
  return `<line ${attrs.join(" ")}/>`;
}

/**
 * Wrap children in an SVG group element.
 */
export function svgGroup(children: string[], transform?: string, className?: string): string {
  const attrs: string[] = [];
  if (transform) attrs.push(`transform="${transform}"`);
  if (className) attrs.push(`class="${className}"`);
  const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
  return `<g${attrStr}>\n${children.join("\n")}\n</g>`;
}

/**
 * Generate full SVG document with viewBox for responsive scaling.
 */
export function svgDoc(
  content: string,
  width: number,
  height: number,
  title?: string
): string {
  const titleAttr = title ? ` aria-label="${escapeXml(title)}"` : "";
  const titleElement = title ? `<title>${escapeXml(title)}</title>\n` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"${titleAttr}>
${titleElement}${content}
</svg>`;
}

/**
 * Convert polar coordinates to cartesian.
 * Angle is in radians, 0 = right, PI/2 = down (SVG coordinate system).
 */
export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleRadians: number
): { x: number; y: number } {
  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  };
}

/**
 * Generate SVG arc path data for a pie slice.
 * Angles in radians, starting from -PI/2 (top of circle).
 */
export function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

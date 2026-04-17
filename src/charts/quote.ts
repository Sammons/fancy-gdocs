/**
 * Quote/testimonial card SVG generator
 */

import type { QuoteChartData, QuoteChartOptions } from "./types.ts";
import { TYPOGRAPHY, LAYOUT } from "./types.ts";
import { svgDoc, svgGroup, svgRect, svgText, svgCircle, escapeXml } from "./utils.ts";

/** Default quote chart dimensions */
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 300;

/** Quote-specific layout constants */
const AVATAR_SIZE = 60;
const AVATAR_MARGIN = 20;
const QUOTE_MARK_SIZE = 48;
const ACCENT_LINE_WIDTH = 4;

/** Typography for quotes */
const QUOTE_TYPOGRAPHY = {
  quote: {
    fontSize: 18,
    fontWeight: 400,
    fontFamily: "Georgia, 'Times New Roman', serif",
    fill: "#202124",
    lineHeight: 1.5,
  },
  attribution: {
    fontSize: 14,
    fontWeight: 600,
    fill: "#202124",
  },
  title: {
    fontSize: 12,
    fontWeight: 400,
    fill: "#5F6368",
  },
};

/** Default accent color */
const DEFAULT_ACCENT = "#4285F4";

/**
 * Wrap text to fit within a given width.
 * Returns array of lines.
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCharWidth = fontSize * 0.5;
  const charsPerLine = Math.floor(maxWidth / avgCharWidth);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > charsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generate decorative quotation mark SVG path.
 */
function svgQuoteMark(x: number, y: number, size: number, color: string, opacity: number): string {
  // Simple quotation mark using text
  return `<text x="${x}" y="${y}" font-size="${size}" font-family="Georgia, serif" fill="${color}" opacity="${opacity}">"</text>`;
}

/**
 * Generate SVG drop shadow filter definition.
 */
function svgShadowFilter(): string {
  return `<defs>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.1"/>
  </filter>
</defs>`;
}

/**
 * Generate an SVG quote/testimonial card from the given data.
 */
export function generateQuote(
  data: QuoteChartData,
  opts: QuoteChartOptions = {}
): string {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const style = opts.style ?? data.style ?? "card";
  const accentColor = data.accentColor ?? DEFAULT_ACCENT;

  const elements: string[] = [];

  // Style-specific rendering
  switch (style) {
    case "card":
      elements.push(renderCardStyle(data, width, height, accentColor));
      break;
    case "minimal":
      elements.push(renderMinimalStyle(data, width, height));
      break;
    case "elegant":
      elements.push(renderElegantStyle(data, width, height, accentColor));
      break;
  }

  // Add shadow filter for card style
  const filterDef = style === "card" ? svgShadowFilter() : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Quote from ${escapeXml(data.authorName ?? "Anonymous")}">
<title>Quote${data.authorName ? ` from ${escapeXml(data.authorName)}` : ""}</title>
${filterDef}${elements.join("\n")}
</svg>`;
}

/**
 * Render card style: background fill, rounded corners, shadow.
 */
function renderCardStyle(data: QuoteChartData, width: number, height: number, accentColor: string): string {
  const elements: string[] = [];
  const padding = LAYOUT.padding + 10;

  // Background card with shadow
  elements.push(
    svgRect(10, 10, width - 20, height - 20, {
      fill: "#FFFFFF",
      rx: 8,
      ry: 8,
    }).replace("/>", ' filter="url(#shadow)"/>')
  );

  // Calculate content area
  const hasAvatar = data.avatarPlaceholder;
  const contentLeft = hasAvatar ? padding + AVATAR_SIZE + AVATAR_MARGIN : padding;
  const contentWidth = width - contentLeft - padding;

  // Avatar placeholder (left side)
  if (hasAvatar) {
    elements.push(
      svgCircle(padding + AVATAR_SIZE / 2, height / 2, AVATAR_SIZE / 2, {
        fill: "#E8EAED",
        stroke: accentColor,
        strokeWidth: 2,
      })
    );
  }

  // Decorative quotation mark (top-left, faded)
  elements.push(
    svgQuoteMark(contentLeft, padding + QUOTE_MARK_SIZE * 0.8, QUOTE_MARK_SIZE, accentColor, 0.2)
  );

  // Quote text
  const quoteY = padding + QUOTE_MARK_SIZE + 10;
  const lines = wrapText(data.text, contentWidth, QUOTE_TYPOGRAPHY.quote.fontSize);
  const lineHeight = QUOTE_TYPOGRAPHY.quote.fontSize * QUOTE_TYPOGRAPHY.quote.lineHeight;

  for (let i = 0; i < lines.length; i++) {
    elements.push(
      svgText(lines[i], contentLeft, quoteY + i * lineHeight, {
        fontSize: QUOTE_TYPOGRAPHY.quote.fontSize,
        fontWeight: QUOTE_TYPOGRAPHY.quote.fontWeight,
        fontFamily: QUOTE_TYPOGRAPHY.quote.fontFamily,
        fill: QUOTE_TYPOGRAPHY.quote.fill,
      })
    );
  }

  // Attribution block
  const attributionY = height - padding - 30;
  if (data.authorName) {
    elements.push(
      svgText(data.authorName, contentLeft, attributionY, {
        fontSize: QUOTE_TYPOGRAPHY.attribution.fontSize,
        fontWeight: QUOTE_TYPOGRAPHY.attribution.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: QUOTE_TYPOGRAPHY.attribution.fill,
      })
    );
  }

  // Title and company
  const titleParts: string[] = [];
  if (data.authorTitle) titleParts.push(data.authorTitle);
  if (data.company) titleParts.push(data.company);
  if (titleParts.length > 0) {
    elements.push(
      svgText(titleParts.join(", "), contentLeft, attributionY + 18, {
        fontSize: QUOTE_TYPOGRAPHY.title.fontSize,
        fontWeight: QUOTE_TYPOGRAPHY.title.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: QUOTE_TYPOGRAPHY.title.fill,
      })
    );
  }

  return elements.join("\n");
}

/**
 * Render minimal style: just text and attribution, no decoration.
 */
function renderMinimalStyle(data: QuoteChartData, width: number, height: number): string {
  const elements: string[] = [];
  const padding = LAYOUT.padding;
  const contentWidth = width - padding * 2;

  // Quote text (centered)
  const lines = wrapText(data.text, contentWidth, QUOTE_TYPOGRAPHY.quote.fontSize);
  const lineHeight = QUOTE_TYPOGRAPHY.quote.fontSize * QUOTE_TYPOGRAPHY.quote.lineHeight;
  const totalTextHeight = lines.length * lineHeight;

  // Center vertically, leaving room for attribution
  const attributionHeight = data.authorName ? 50 : 0;
  const startY = (height - totalTextHeight - attributionHeight) / 2 + QUOTE_TYPOGRAPHY.quote.fontSize;

  for (let i = 0; i < lines.length; i++) {
    elements.push(
      svgText(lines[i], width / 2, startY + i * lineHeight, {
        fontSize: QUOTE_TYPOGRAPHY.quote.fontSize,
        fontWeight: QUOTE_TYPOGRAPHY.quote.fontWeight,
        fontFamily: QUOTE_TYPOGRAPHY.quote.fontFamily,
        fill: QUOTE_TYPOGRAPHY.quote.fill,
        textAnchor: "middle",
      })
    );
  }

  // Attribution (centered below quote)
  if (data.authorName) {
    const attrY = startY + totalTextHeight + 20;
    let attributionText = `\u2014 ${data.authorName}`;
    if (data.authorTitle) attributionText += `, ${data.authorTitle}`;
    if (data.company) attributionText += `, ${data.company}`;

    elements.push(
      svgText(attributionText, width / 2, attrY, {
        fontSize: QUOTE_TYPOGRAPHY.title.fontSize,
        fontWeight: QUOTE_TYPOGRAPHY.title.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: QUOTE_TYPOGRAPHY.title.fill,
        textAnchor: "middle",
      })
    );
  }

  return elements.join("\n");
}

/**
 * Render elegant style: large quote marks, thin accent line.
 */
function renderElegantStyle(data: QuoteChartData, width: number, height: number, accentColor: string): string {
  const elements: string[] = [];
  const padding = LAYOUT.padding + 20;
  const contentWidth = width - padding * 2;

  // Large decorative quotation mark (top-left)
  const largeQuoteSize = QUOTE_MARK_SIZE * 1.5;
  elements.push(
    svgQuoteMark(padding - 10, padding + largeQuoteSize * 0.7, largeQuoteSize, accentColor, 0.3)
  );

  // Thin accent line (left side)
  elements.push(
    `<rect x="${padding - 20}" y="${padding + largeQuoteSize + 10}" width="${ACCENT_LINE_WIDTH}" height="${height - padding * 2 - largeQuoteSize - 10}" fill="${accentColor}" rx="2" ry="2"/>`
  );

  // Quote text
  const quoteY = padding + largeQuoteSize + 30;
  const lines = wrapText(data.text, contentWidth - 20, QUOTE_TYPOGRAPHY.quote.fontSize + 2);
  const lineHeight = (QUOTE_TYPOGRAPHY.quote.fontSize + 2) * QUOTE_TYPOGRAPHY.quote.lineHeight;

  for (let i = 0; i < lines.length; i++) {
    elements.push(
      svgText(lines[i], padding, quoteY + i * lineHeight, {
        fontSize: QUOTE_TYPOGRAPHY.quote.fontSize + 2,
        fontWeight: QUOTE_TYPOGRAPHY.quote.fontWeight,
        fontFamily: QUOTE_TYPOGRAPHY.quote.fontFamily,
        fill: QUOTE_TYPOGRAPHY.quote.fill,
      })
    );
  }

  // Avatar placeholder (right side, for elegant)
  if (data.avatarPlaceholder) {
    const avatarX = width - padding - AVATAR_SIZE / 2;
    const avatarY = height - padding - AVATAR_SIZE / 2;
    elements.push(
      svgCircle(avatarX, avatarY, AVATAR_SIZE / 2, {
        fill: "#E8EAED",
        stroke: accentColor,
        strokeWidth: 2,
      })
    );
  }

  // Attribution block (bottom)
  const attributionY = height - padding;
  if (data.authorName) {
    elements.push(
      svgText(data.authorName, padding, attributionY - 18, {
        fontSize: QUOTE_TYPOGRAPHY.attribution.fontSize,
        fontWeight: QUOTE_TYPOGRAPHY.attribution.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: QUOTE_TYPOGRAPHY.attribution.fill,
      })
    );
  }

  const titleParts: string[] = [];
  if (data.authorTitle) titleParts.push(data.authorTitle);
  if (data.company) titleParts.push(data.company);
  if (titleParts.length > 0) {
    elements.push(
      svgText(titleParts.join(", "), padding, attributionY, {
        fontSize: QUOTE_TYPOGRAPHY.title.fontSize,
        fontWeight: QUOTE_TYPOGRAPHY.title.fontWeight,
        fontFamily: TYPOGRAPHY.fontFamily,
        fill: QUOTE_TYPOGRAPHY.title.fill,
      })
    );
  }

  return elements.join("\n");
}

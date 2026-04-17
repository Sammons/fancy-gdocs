# Chart Generation Design

Zero-dependency SVG chart generation for embedding in Google Docs. LLM-authored JSON in, beautiful SVG out.

## CLI Interface

```bash
# Pie chart
pnpm gdocs chart pie <data.json> [--out chart.svg] [--width 400] [--height 400]

# Bar chart
pnpm gdocs chart bar <data.json> [--out chart.svg] [--width 600] [--height 400] [--horizontal] [--stacked]

# Scatter plot
pnpm gdocs chart scatter <data.json> [--out chart.svg] [--width 600] [--height 400] [--trend-line]

# Sankey diagram
pnpm gdocs chart sankey <data.json> [--out chart.svg] [--width 800] [--height 500]

# Quote/testimonial card
pnpm gdocs chart quote <data.json> [--out quote.svg] [--width 600] [--height 300] [--style elegant]
```

### Common Options

| Option | Default | Description |
|--------|---------|-------------|
| `--out` | stdout | Output file path |
| `--width` | 400-800 | Chart width in pixels (varies by type) |
| `--height` | 400-500 | Chart height in pixels (varies by type) |

### Type-Specific Options

**Bar:**
- `--horizontal`: Render bars horizontally (default: vertical)
- `--stacked`: Stack grouped bars (default: grouped side-by-side)

**Scatter:**
- `--trend-line`: Add linear regression trend line

**Quote:**
- `--style`: Style variant: `card` (default), `minimal`, `elegant`

## Data Formats

### Pie Chart

```typescript
interface PieChartData {
  title?: string;
  data: Array<{
    label: string;
    value: number;
    color?: string;  // hex color, e.g., "#4285F4"
  }>;
}
```

Example:
```json
{
  "title": "Revenue by Region",
  "data": [
    { "label": "North America", "value": 45 },
    { "label": "Europe", "value": 30 },
    { "label": "Asia Pacific", "value": 20 },
    { "label": "Other", "value": 5 }
  ]
}
```

### Bar Chart

Simple (single series):
```typescript
interface BarChartData {
  title?: string;
  xAxis?: string;
  yAxis?: string;
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
}
```

Grouped/Stacked (multiple series):
```typescript
interface GroupedBarChartData {
  title?: string;
  xAxis?: string;
  yAxis?: string;
  categories: string[];  // x-axis labels
  series: Array<{
    name: string;
    values: number[];    // one per category
    color?: string;
  }>;
}
```

Example (simple):
```json
{
  "title": "Monthly Sales",
  "xAxis": "Month",
  "yAxis": "Revenue ($K)",
  "data": [
    { "label": "Jan", "value": 120 },
    { "label": "Feb", "value": 150 },
    { "label": "Mar", "value": 180 }
  ]
}
```

Example (grouped):
```json
{
  "title": "Quarterly Revenue",
  "xAxis": "Quarter",
  "yAxis": "Revenue ($M)",
  "categories": ["Q1", "Q2", "Q3", "Q4"],
  "series": [
    { "name": "2024", "values": [10, 12, 15, 18] },
    { "name": "2025", "values": [12, 14, 17, 22] }
  ]
}
```

### Scatter Plot

```typescript
interface ScatterChartData {
  title?: string;
  xAxis?: string;
  yAxis?: string;
  series: Array<{
    name: string;
    points: Array<{ x: number; y: number }>;
    color?: string;
  }>;
}
```

Example:
```json
{
  "title": "Price vs Performance",
  "xAxis": "Price ($)",
  "yAxis": "Performance Score",
  "series": [
    {
      "name": "Product A",
      "points": [
        { "x": 100, "y": 75 },
        { "x": 150, "y": 82 },
        { "x": 200, "y": 88 }
      ]
    },
    {
      "name": "Product B",
      "points": [
        { "x": 120, "y": 70 },
        { "x": 180, "y": 85 }
      ]
    }
  ]
}
```

### Sankey Diagram

```typescript
interface SankeyChartData {
  title?: string;
  nodes: Array<{
    id: string;
    label: string;
    color?: string;
  }>;
  links: Array<{
    source: string;  // node id
    target: string;  // node id
    value: number;
  }>;
}
```

Example:
```json
{
  "title": "Traffic Sources to Conversions",
  "nodes": [
    { "id": "organic", "label": "Organic Search" },
    { "id": "paid", "label": "Paid Ads" },
    { "id": "social", "label": "Social Media" },
    { "id": "landing", "label": "Landing Page" },
    { "id": "signup", "label": "Sign Up" },
    { "id": "purchase", "label": "Purchase" }
  ],
  "links": [
    { "source": "organic", "target": "landing", "value": 5000 },
    { "source": "paid", "target": "landing", "value": 3000 },
    { "source": "social", "target": "landing", "value": 2000 },
    { "source": "landing", "target": "signup", "value": 4000 },
    { "source": "landing", "target": "purchase", "value": 1500 },
    { "source": "signup", "target": "purchase", "value": 2500 }
  ]
}
```

### Quote/Testimonial Card

```typescript
interface QuoteChartData {
  text: string;                    // The quote text
  authorName?: string;             // Name
  authorTitle?: string;            // Job title / role
  company?: string;                // Company name
  avatarPlaceholder?: boolean;     // Show circle placeholder for photo
  style?: "card" | "minimal" | "elegant";
  accentColor?: string;            // For decorative elements (hex color)
}
```

Example:
```json
{
  "text": "This product changed everything for our team.",
  "authorName": "Jane Smith",
  "authorTitle": "CEO",
  "company": "Acme Corp",
  "avatarPlaceholder": true,
  "style": "elegant",
  "accentColor": "#4285F4"
}
```

**Style variants:**
- **card**: Background fill, rounded corners, drop shadow — suitable for presentation slides
- **minimal**: Just text and attribution, no decoration — clean and understated
- **elegant**: Large decorative quotation marks, thin accent line — premium feel

## Styling Defaults

### Color Palette

Accessible, WCAG AA compliant palette with sufficient contrast:

```typescript
const PALETTE = [
  "#4285F4",  // Google Blue
  "#EA4335",  // Google Red
  "#FBBC05",  // Google Yellow
  "#34A853",  // Google Green
  "#FF6D01",  // Orange
  "#46BDC6",  // Teal
  "#7B1FA2",  // Purple
  "#C2185B",  // Pink
  "#5E35B1",  // Deep Purple
  "#00897B",  // Dark Teal
];
```

Colors are assigned in order when not explicitly specified. The palette wraps if more than 10 categories are needed.

### Typography

```typescript
const TYPOGRAPHY = {
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
```

### Layout

```typescript
const LAYOUT = {
  padding: 20,
  titleMargin: 16,
  legendSpacing: 8,
  axisTickLength: 5,
  gridLineColor: "#E8EAED",
  gridLineOpacity: 0.8,
};
```

### Chart-Specific Defaults

**Pie:**
- Donut hole: 0 (solid pie, no hole)
- Stroke: 2px white between slices
- Label placement: outside with leader lines when space allows

**Bar:**
- Bar corner radius: 2px
- Bar gap ratio: 0.2 (20% of bar width)
- Group gap ratio: 0.1 (for grouped bars)
- Axis grid lines: horizontal only

**Scatter:**
- Point radius: 5px
- Point stroke: 1.5px white
- Trend line: dashed, 50% opacity
- Axis grid lines: both axes

**Sankey:**
- Node width: 20px
- Node padding: 10px
- Link opacity: 0.5 (hover: 0.8)
- Curved bezier links

**Quote:**
- Avatar size: 60px diameter
- Quotation mark size: 48px (elegant: 72px)
- Accent line width: 4px
- Quote font: Georgia, Times New Roman, serif
- Attribution font: system-ui (matches other charts)

## File Structure

```
scripts/charts/
  index.ts          # CLI router and argument parsing
  types.ts          # TypeScript interfaces for all data formats
  colors.ts         # Color palette and assignment logic
  pie.ts            # Pie chart SVG generator
  bar.ts            # Bar chart SVG generator
  scatter.ts        # Scatter plot SVG generator
  sankey.ts         # Sankey diagram SVG generator
  quote.ts          # Quote/testimonial card SVG generator
  utils.ts          # Shared SVG helpers
```

### Module Responsibilities

**index.ts:**
- Parse `chart <type> <file> [options]` from entrypoint delegation
- Read and validate JSON input
- Route to appropriate generator
- Write output (file or stdout)

**types.ts:**
- Export all data format interfaces
- Type guards for runtime validation
- Union type for any chart data

**colors.ts:**
- `PALETTE` constant
- `assignColors(data, palette)` — fill missing colors in order
- `hexToRgb(hex)` / `rgbToHex(r, g, b)` — color utilities

**pie.ts:**
- `generatePie(data: PieChartData, opts: ChartOptions): string`
- Arc path calculation
- Label positioning with collision avoidance
- Legend rendering

**bar.ts:**
- `generateBar(data: BarChartData | GroupedBarChartData, opts: BarChartOptions): string`
- Scale calculation for y-axis
- Grouped vs stacked logic
- Axis rendering with tick marks

**scatter.ts:**
- `generateScatter(data: ScatterChartData, opts: ScatterChartOptions): string`
- Axis scaling (auto min/max with padding)
- Point rendering per series
- Linear regression for trend line

**sankey.ts:**
- `generateSankey(data: SankeyChartData, opts: ChartOptions): string`
- Node positioning algorithm (minimize link crossings)
- Bezier curve link paths
- Node labels

**quote.ts:**
- `generateQuote(data: QuoteChartData, opts: QuoteChartOptions): string`
- Three style variants: card, minimal, elegant
- Text wrapping for long quotes
- Avatar placeholder rendering
- Decorative quotation marks

**utils.ts:**
- `svgText(content, x, y, opts)` — text element with styling
- `svgRect(x, y, w, h, opts)` — rectangle with optional rounded corners
- `svgPath(d, opts)` — path element
- `svgCircle(cx, cy, r, opts)` — circle element
- `svgGroup(children, transform?)` — g element wrapper
- `svgDoc(content, width, height)` — full SVG document wrapper
- `escapeXml(str)` — escape special characters

## SVG Output

### ViewBox Strategy

All charts use a viewBox for responsive scaling:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
```

This allows the SVG to scale proportionally when embedded in Google Docs.

### Accessibility

- `role="img"` on root SVG
- `aria-label` with chart title
- `<title>` element as first child
- Semantic grouping with `<g>` elements

Example structure:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Revenue by Region">
  <title>Revenue by Region</title>
  <g class="chart-title">...</g>
  <g class="chart-content">...</g>
  <g class="chart-legend">...</g>
</svg>
```

## Integration with gdocs Skill

### Entrypoint Delegation

In `entrypoint.ts`, add a case for the `chart` subcommand:

```typescript
case "chart":
  await handleChart(args.slice(1));
  break;
```

The `handleChart` function delegates to the chart router in `charts/index.ts`.

### Embedding in Documents

Generated SVGs can be:
1. Uploaded to a public URL and embedded via image blocks
2. Base64 encoded and embedded inline (if Google Docs supports data URIs)
3. Converted to PNG via headless browser and embedded

Recommended approach: upload SVG to a static file server, reference in doc via image block.

## Future Considerations

- **Line charts**: Similar to scatter but with connected points
- **Area charts**: Filled line charts
- **Heatmaps**: 2D color matrices
- **Interactive SVGs**: Hover effects (limited use in Docs)
- **Animation**: Entry animations (not supported in Docs)

These are out of scope for v1 but the architecture supports extension.

## Example Usage

```bash
# Generate pie chart to stdout
pnpm gdocs chart pie /tmp/revenue.json

# Generate bar chart to file
pnpm gdocs chart bar /tmp/sales.json --out /tmp/sales-chart.svg --width 800

# Generate horizontal stacked bar chart
pnpm gdocs chart bar /tmp/breakdown.json --horizontal --stacked --out breakdown.svg

# Generate scatter with trend line
pnpm gdocs chart scatter /tmp/correlation.json --trend-line --out correlation.svg

# Generate sankey diagram
pnpm gdocs chart sankey /tmp/flow.json --out flow.svg --width 1000 --height 600

# Generate quote card
pnpm gdocs chart quote /tmp/testimonial.json --out quote.svg --style elegant
```

## Validation

Input JSON is validated at runtime:
- Required fields present
- Values are correct types (numbers, strings, arrays)
- Node IDs in Sankey links reference existing nodes
- At least one data point per series

Invalid input produces a clear error message and exits with code 1.

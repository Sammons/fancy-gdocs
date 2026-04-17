---
name: gdocs
description: "Create richly formatted Google Docs from a declarative block DSL — themes, callouts, footnotes, tables (merge/pin/column-widths/multi-run cells), images, lists (nested), @-mentions, default headers/footers, section breaks (columns/orientation), document margins, multi-tab"
argument-hint: "create <file.json> [--dry-run]"
allowed-tools: Bash, Read, Write
user-invocable: true
---

# gdocs

Create richly formatted Google Docs in a single pass. Agents write a declarative JSON file describing the document structure, and the builder compiles it into Google Docs API batchUpdate requests with automatic index tracking.

> **API Reference**: When modifying this skill's compiler or adding new block types, load `api-docs.md` in its ENTIRETY (not chunked). It contains the full Google Docs API v1 type surface in ~770 lines.

## Quick Reference

```bash
pnpm gdocs create /tmp/doc.json              # create doc, return URL
pnpm gdocs create /tmp/doc.json --dry-run    # emit compiled batchUpdate JSON only
```

## Authentication

Uses Zapier SDK relay for Google Docs API access. Set a connection ID via env var:

```bash
export GDOCS_CONNECTION=12345                # single account (used for both work/personal)
export GDOCS_CONNECTION_WORK=12345           # account-specific
export GDOCS_CONNECTION_PERSONAL=67890       # account-specific
```

Find connection IDs: `npx zapier-sdk list-connections google_docs`

## Rules

1. **Always write the full DSL JSON to a temp file first**, then pass the path to `pnpm gdocs create`.
2. **Never write raw batchUpdate requests.** Use the block DSL below. The builder handles index math.
3. **Images must be publicly accessible URLs** (or Google Drive share links). The Docs API fetches them server-side. SVG images are auto-relayed through Google Drive for server-side transcoding (no Docker needed).
4. For multi-tab docs, use the `tabs` array. For single-tab, use `blocks` directly.

## DSL Format

```jsonc
{
  "title": "Document Title",         // required
  "account": "work",                 // optional — "work" (default) or "personal"

  // Document style — page margins, size, orientation, background
  "documentStyle": {
    "marginTop": 72,                 // pt (default ~72)
    "marginBottom": 72,
    "marginLeft": 72,
    "marginRight": 72,
    "size": "LETTER",                // LETTER | A4 | LEGAL (overrides pageWidth/pageHeight)
    "pageWidth": 612,                // pt (612 = US Letter) — used if no size preset
    "pageHeight": 792,
    "orientation": "PORTRAIT",       // PORTRAIT | LANDSCAPE
    "background": "#FAFAFA",         // page background color
    "marginHeader": 36,              // pt — distance from page edge to header
    "marginFooter": 36               // pt — distance from page edge to footer
  },

  // Theme — redefine how named styles render (applied inline since API is read-only)
  "theme": {
    "TITLE": { "fontFamily": "Georgia", "fontSize": 28, "color": "#1A1A2E" },
    "HEADING_1": { "fontFamily": "Georgia", "fontSize": 22, "color": "#16213E", "spacing": { "before": 18, "after": 6 } },
    "HEADING_2": { "fontFamily": "Georgia", "fontSize": 16, "color": "#1F4287" },
    "NORMAL_TEXT": { "fontFamily": "Inter", "fontSize": 11, "lineSpacing": 1.15, "color": "#333333" }
  },

  // Headers and footers — only the DEFAULT slot is API-writable.
  // firstPageHeaderId / evenPageHeaderId are read-only on the Docs API and
  // can only be authored via the Docs UI or copied from a template.
  "header": { "text": "Header" },            // default header (supports runs)
  "footer": { "text": "Footer" },            // default footer (supports runs)
  // NOT SUPPORTED: firstPageHeader, firstPageFooter, evenPageHeader, evenPageFooter.
  // Workaround: drive.files.copy a UI-authored template and replaceAllText.

  "blocks": [                        // single-tab shorthand
    // ... block objects
  ]
  // OR for multi-tab:
  "tabs": [
    { "title": "Tab Name", "blocks": [ /* ... */ ] },
    { "title": "Another Tab", "blocks": [ /* ... */ ] }
  ]
}
```

### Theme Style Properties

Each named style in the `theme` object supports:

| Property | Type | Description |
|----------|------|-------------|
| `fontFamily` | string | Font family (e.g. "Georgia", "Inter") |
| `fontSize` | number | Font size in pt |
| `color` | string | Text color "#RRGGBB" |
| `bold` | boolean | Bold |
| `italic` | boolean | Italic |
| `smallCaps` | boolean | Small capitals |
| `fontWeight` | number | Font weight 100-900 |
| `lineSpacing` | number | Line spacing multiplier (1.15 = 115%). Values ≤10 are multipliers; >10 treated as percentage directly. |
| `fill` | string | Paragraph background "#RRGGBB" |
| `spacing` | object | `{ before?: number, after?: number }` in pt |
| `borders` | object | Paragraph borders (see paragraph borders below) |

## Block Types

### title
```json
{ "type": "title", "text": "Document Title" }
```
Maps to Google Docs TITLE named style. Supports optional `alignment` (`"START"`, `"CENTER"`, `"END"`).

### subtitle
```json
{ "type": "subtitle", "text": "A subtitle line" }
```
Maps to Google Docs SUBTITLE named style. Supports optional `alignment`. Also accepts `runs?: Run[]` for inline styled spans (same shape as paragraph runs).

### heading
```json
{ "type": "heading", "level": 1, "text": "Section Title", "alignment": "CENTER" }
```
Or with styled runs (e.g. superscript citations, S² math notation, footnote anchors inside a heading):
```json
{
  "type": "heading", "level": 2,
  "runs": [
    { "text": "Section S" },
    { "text": "2", "superscript": true, "bold": true, "color": "#1F4287" }
  ]
}
```
```json
{
  "type": "heading", "level": 2,
  "runs": [
    { "text": "Spec compliance " },
    { "text": "[1]", "superscript": true, "link": "https://example.com/spec", "color": "#1A73E8" }
  ]
}
```
Levels 1-6 map to Google Docs HEADING_1 through HEADING_6. Supports optional `alignment`. Use `text` for a plain heading or `runs` for per-character styling overrides — run-level color/bold/baselineOffset/link are preserved over the heading's theme. `title` and `subtitle` accept the same `runs?` shape.

#### In-doc anchor links

Tag a heading with `anchor: "name"` and other runs can link to it with `link: "#name"`. The compiler does a second batchUpdate under the hood to resolve the server-assigned `headingId`.

```json
{ "type": "heading", "level": 1, "text": "References", "anchor": "references" },
{ "type": "heading", "level": 3, "text": "[1] Bringhurst, The Elements of Typographic Style", "anchor": "ref1" },

{ "type": "paragraph", "runs": [
  { "text": "See Bringhurst " },
  { "text": "[1]", "superscript": true, "link": "#ref1", "color": "#1A73E8" },
  { "text": " for line-length guidance." }
]}
```

Anchor-name matching is by (level, exact heading text) within a tab — same-text headings at different levels are fine; same-text at the same level within a tab is ambiguous and takes the first match. Unresolved `#names` (no matching `anchor:`) fail the run with a clear error.

### paragraph
```json
{ "type": "paragraph", "text": "Plain text." }
```
Or with inline formatting:
```json
{
  "type": "paragraph",
  "runs": [
    { "text": "Bold ", "bold": true },
    { "text": "and italic", "italic": true, "bold": true },
    { "text": " normal." }
  ]
}
```
With extended properties:
```json
{
  "type": "paragraph",
  "text": "Indented with line spacing",
  "lineSpacing": 1.5,
  "indent": { "left": 36, "firstLine": 18 },
  "keepWithNext": true,
  "fill": "#F5F5F5",
  "borders": {
    "left": { "color": "#2196F3", "width": 3, "padding": 8 }
  }
}
```

| Paragraph Property | Type | Description |
|-------------------|------|-------------|
| `alignment` | string | `"START"`, `"CENTER"`, `"END"` |
| `spacing` | object | `{ before?: number, after?: number }` in pt |
| `lineSpacing` | number | Line spacing multiplier (1.0, 1.15, 1.5, 2.0). Values ≤10 are treated as multipliers (×100 internally); values >10 are treated as percentages. Use multiplier form. |
| `indent` | object | `{ left?, right?, firstLine? }` in pt |
| `keepWithNext` | boolean | Prevent page break between this and next paragraph |
| `keepTogether` | boolean | Prevent page break within this paragraph |
| `pageBreakBefore` | boolean | Force page break before this paragraph |
| `fill` | string | Paragraph background color "#RRGGBB" |
| `borders` | object | `{ top?, bottom?, left?, right? }` each with `{ color, width, dashStyle?, padding? }` |

### callout
```json
{ "type": "callout", "style": "INFO", "runs": [
  { "text": "Key finding: ", "bold": true },
  { "text": "Revenue grew 12% above projections." }
]}
```
Preset styles with exact colors:

| Preset | Fill | Border |
|--------|------|--------|
| `"INFO"` | `#E3F2FD` (light blue) | `#2196F3` (blue) |
| `"WARNING"` | `#FFF3E0` (light orange) | `#FF9800` (orange) |
| `"SUCCESS"` | `#E8F5E9` (light green) | `#4CAF50` (green) |
| `"NOTE"` | `#F3E5F5` (light purple) | `#9C27B0` (purple) |

Custom styling:
```json
{ "type": "callout", "fill": "#FFF3E0", "borderColor": "#FF9800", "text": "Custom callout." }
```
Compiles to a paragraph with left border + background shading.

### blockquote
```json
{ "type": "blockquote", "text": "According to the analysis..." }
```
With rich formatting:
```json
{ "type": "blockquote", "runs": [
  { "text": "The key takeaway: ", "bold": true },
  { "text": "margins improved 3.2 percentage points year-over-year." }
]}
```
Compiles to an indented paragraph with gray left border (`#CCCCCC`, 3pt) and light background (`#F9F9F9`), indent 36pt.

### table
```json
{
  "type": "table",
  "rows": [
    [{ "text": "Header 1", "bold": true, "fill": "#1A73E8", "color": "#FFFFFF" },
     { "text": "Header 2", "bold": true, "fill": "#1A73E8", "color": "#FFFFFF" }],
    [{ "text": "Cell A", "fill": "#F8F9FA" },
     { "runs": [{ "text": "Bold ", "bold": true }, { "text": "and normal" }], "fill": "#F8F9FA" }]
  ],
  "pinnedHeaderRows": 1,
  "columnWidths": [200, 100],
  "merge": [{ "row": 0, "col": 0, "rowSpan": 1, "colSpan": 2 }]
}
```

Table cells support two content modes:
- **Single-run**: `{ "text": "content", "bold": true }` — one text string with uniform formatting
- **Multi-run**: `{ "runs": [{ "text": "Bold ", "bold": true }, { "text": "normal" }] }` — mixed formatting within a cell

| Table Property | Type | Description |
|---------------|------|-------------|
| `pinnedHeaderRows` | number | Number of rows to pin as repeating headers |
| `columnWidths` | number[] | Column widths in pt (applied as FIXED_WIDTH) |
| `merge` | array | Cell merge specs: `{ row, col, rowSpan, colSpan }` |
| `rowMinHeight` | number | Minimum row height in pt (applied to all rows) |
| `preventOverflow` | boolean | Prevent row content from splitting across pages |

### image
```json
{ "type": "image", "uri": "https://example.com/chart.png", "width": 400, "height": 300 }
```
Width/height in points (1 pt = 1/72 inch). Both optional — defaults to natural image size.

**SVG support:** Docs API's `insertInlineImage` natively supports PNG/JPEG/GIF only, so `.svg` URIs are auto-relayed through Google Drive — the `drive.google.com/thumbnail?id=` endpoint transcodes SVG → raster server-side. The source SVG URL must be a real SVG response (content-type `image/svg+xml`, >256 bytes); the skill fails loud if the download returns an HTML error page.

### list
```json
{
  "type": "list",
  "style": "BULLET",
  "items": [
    { "text": "First point" },
    { "text": "Nested item", "level": 1 },
    { "text": "Deep nested", "level": 2 },
    { "runs": [{ "text": "Rich ", "bold": true }, { "text": "item" }] }
  ]
}
```
Style: `"BULLET"`, `"NUMBER"`, or `"CHECK"` (checkbox/checklist).

Items support `level` (0-8) for nested list indentation. Default is 0 (top level).

### pageBreak
```json
{ "type": "pageBreak" }
```

### sectionBreak
```json
{ "type": "sectionBreak" }
{ "type": "sectionBreak", "sectionType": "CONTINUOUS" }
{ "type": "sectionBreak", "sectionType": "NEXT_PAGE", "orientation": "LANDSCAPE" }
{ "type": "sectionBreak", "sectionType": "CONTINUOUS", "columns": 2, "columnSeparator": true }
```
Section type: `"NEXT_PAGE"` (default) or `"CONTINUOUS"`.

| Section Property | Type | Description |
|-----------------|------|-------------|
| `orientation` | string | `"PORTRAIT"` or `"LANDSCAPE"` — requires NEXT_PAGE |
| `columns` | number | Number of columns for the following section |
| `columnSeparator` | boolean | Vertical line between columns |

### hr
```json
{ "type": "hr" }
```

## `fill` Property Disambiguation

The `fill` property appears in three contexts with different effects:

| Context | Effect | API mapping |
|---------|--------|-------------|
| **Run** (`runs[].fill`) | Text highlight (inline background behind the text) | `TextStyle.backgroundColor` |
| **Paragraph** (`block.fill`) | Full-width paragraph shading | `ParagraphStyle.shading.backgroundColor` |
| **Table cell** (`cell.fill`) | Cell background color | `TableCellStyle.backgroundColor` |

In **single-run table cells** (e.g. `{ "text": "X", "fill": "#F00" }`), `fill` applies as **cell background** — the cell-level interpretation takes priority. Use `runs` if you need text highlight inside a cell instead.

## Run Properties (Inline Formatting)

Every `text` field can be replaced by a `runs` array for mixed formatting. Each run:

| Property | Type | Description |
|----------|------|-------------|
| `text` | string | **Required.** The text content. |
| `bold` | boolean | Bold |
| `italic` | boolean | Italic |
| `underline` | boolean | Underline |
| `strikethrough` | boolean | Strikethrough |
| `superscript` | boolean | Superscript |
| `subscript` | boolean | Subscript |
| `fontSize` | number | Font size in pt |
| `fontFamily` | string | e.g. "Roboto Mono" |
| `color` | string | Foreground color "#RRGGBB" |
| `highlight` | string | Background highlight "#RRGGBB" (alias: `fill`) |
| `fill` | string | Background highlight "#RRGGBB" (alias: `highlight`) |
| `link` | string | URL to hyperlink |
| `mention` | string | Email for @-mention (person smart chip) |
| `smallCaps` | boolean | Small capitals rendering |
| `fontWeight` | number | Font weight 100-900 (overrides bold) |
| `footnote` | string or Run[] | Creates footnote at this position. String = plain text, Run[] = rich content. |
| `date` | string | ISO date `"YYYY-MM-DD"` — inserts a date smart chip at this position. |

### Footnote Examples

Plain text footnote:
```json
{
  "type": "paragraph",
  "runs": [
    { "text": "Revenue exceeded projections" },
    { "footnote": "Figures are preliminary and subject to audit." },
    { "text": " by 12%." }
  ]
}
```

Rich footnote with formatting:
```json
{
  "type": "paragraph",
  "runs": [
    { "text": "See supplementary materials" },
    { "footnote": [
      { "text": "Supplementary materials include: ", "bold": true },
      { "text": "interview transcripts, survey data, and financial models." }
    ] },
    { "text": "." }
  ]
}
```

> Footnote runs have no `text` property on the parent — the `footnote` property replaces it. The compiler inserts a footnote reference character at that position. Multiple footnotes in a paragraph are supported.

### @-Mention Example

Person mentions create smart chips (no `text` property needed — the chip renders the person's name):
```json
{
  "type": "paragraph",
  "runs": [
    { "text": "Assigned to " },
    { "mention": "jane@example.com" },
    { "text": " for review." }
  ]
}
```

## Table Cell Properties

Table cells support all run properties above, plus cell-level styling:

| Property | Type | Description |
|----------|------|-------------|
| `runs` | Run[] | Multi-run cell content (alternative to single text) |
| `fill` | string | Cell fill color "#RRGGBB" (alias: `backgroundColor`) |
| `backgroundColor` | string | Cell fill color "#RRGGBB" (alias: `fill`) |
| `borderTop` | object | `{ color?: "#RRGGBB", width?: number, dashStyle?: "SOLID"\|"DASH"\|"DOT" }` |
| `borderBottom` | object | Same as borderTop |
| `borderLeft` | object | Same as borderTop |
| `borderRight` | object | Same as borderTop |
| `padding` | number | Uniform cell padding in pt (all 4 sides) |
| `paddingTop` | number | Per-side padding override |
| `paddingBottom` | number | Per-side padding override |
| `paddingLeft` | number | Per-side padding override |
| `paddingRight` | number | Per-side padding override |
| `verticalAlignment` | string | `"TOP"`, `"MIDDLE"`, or `"BOTTOM"` |

## Multi-Tab Docs

Use the `tabs` array instead of `blocks`. The first tab becomes the default tab; additional tabs are created as real Google Docs tabs via `addDocumentTab`. Each tab supports all block types. Optional `icon` sets a tab emoji icon.

**Tab icon constraint:** Google Docs only accepts single-codepoint emojis. ZWJ (zero-width-joiner) sequences and multi-codepoint glyphs are rejected with `"Not a valid emoji input"`. Safe: `📊 📈 📎 📝 📁 ✏ ▦`. Unsafe: `🖼` (multi-codepoint), `👨‍💻` (ZWJ), country flags, family glyphs.

```json
{
  "title": "Quarterly Report",
  "tabs": [
    { "title": "Summary", "icon": "📊", "blocks": [ /* ... */ ] },
    { "title": "Data", "icon": "📈", "blocks": [ /* ... */ ] },
    { "title": "Appendix", "icon": "📎", "blocks": [ /* ... */ ] }
  ]
}
```

## Known Limitations

- **Table of Contents**: Cannot be created via the API. Insert a placeholder heading and add a TOC manually via the Docs UI.
- **Named style definitions**: Read-only in the API (`updateNamedStyles` does not exist). Use the `theme` object instead — it applies styles inline per block.
- **Table cell block content**: Cells support text runs only, not block-level content (lists, images, nested tables).
- **Rich links**: `insertRichLink` is a read-only phantom in the API — no write path.
- **Page numbers in headers/footers**: The API does not support auto-text (PAGE_NUMBER, PAGE_COUNT) in header/footer content. Use manual text.

## Examples

### Themed Consulting Report
```json
{
  "title": "Q2 Board Report",
  "documentStyle": { "size": "LETTER", "marginTop": 54, "marginBottom": 54 },
  "theme": {
    "TITLE": { "fontFamily": "Georgia", "fontSize": 28, "color": "#1A1A2E" },
    "HEADING_1": { "fontFamily": "Georgia", "fontSize": 22, "color": "#16213E" },
    "NORMAL_TEXT": { "fontFamily": "Inter", "fontSize": 11, "lineSpacing": 1.15 }
  },
  "header": { "runs": [{ "text": "CONFIDENTIAL", "smallCaps": true, "fontSize": 8, "color": "#999" }] },
  "blocks": [
    { "type": "title", "text": "Q2 Board Report" },
    { "type": "heading", "level": 1, "text": "Executive Summary" },
    { "type": "callout", "style": "SUCCESS", "runs": [
      { "text": "Key result: ", "bold": true },
      { "text": "Revenue exceeded projections by 12%" },
      { "footnote": "Preliminary figures subject to audit." }
    ]},
    { "type": "paragraph", "text": "Full analysis follows below." },
    { "type": "table", "rows": [
      [{ "text": "Metric", "bold": true, "fill": "#1A1A2E", "color": "#FFF" },
       { "text": "Value", "bold": true, "fill": "#1A1A2E", "color": "#FFF" }],
      [{ "text": "Revenue" }, { "runs": [{ "text": "$4.2M", "bold": true, "color": "#4CAF50" }] }]
    ], "pinnedHeaderRows": 1 }
  ]
}
```

# fancy-gdocs

Write Google Docs in JSON. Get perfectly formatted documents out.

```json
{
  "title": "Q1 Report",
  "blocks": [
    { "type": "heading", "level": 1, "text": "Executive Summary" },
    { "type": "paragraph", "text": "Revenue up 23%. Costs down 12%." },
    { "type": "table", "rows": [["Metric", "Value"], ["ARR", "$4.2M"], ["Churn", "2.1%"]] }
  ]
}
```

That's it. Run `fancy-gdocs create report.json` and you have a real Google Doc with proper headings, styled tables, and consistent formatting.

## What You Get

- **JSON to Docs** — Define structure, get batchUpdate requests or live documents
- **Charts** — Pie, bar, scatter, sankey diagrams as inline SVGs
- **Themes** — `--theme corporate` for instant professional styling
- **Round-trip validation** — Create a doc, read it back, diff the content
- **Multi-tab documents** — Because one tab is never enough

## Quick Start

**Claude Code** (recommended):
```bash
/plugin marketplace add git@github.com:Sammons/sammons-claude-marketplace.git
/plugin install fancy-gdocs

# Then use /gdocs in any conversation
```

**Standalone CLI**:
```bash
pnpm add @sammons/fancy-gdocs

# Create a doc
fancy-gdocs create spec.json

# Preview without touching the API
fancy-gdocs create spec.json --dry-run

# Read an existing doc back as JSON
fancy-gdocs read 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Generate a pie chart
fancy-gdocs chart pie '{"data": [{"label": "Yes", "value": 73}, {"label": "No", "value": 27}]}'
```

## DSL Blocks

| Type | What it does |
|------|--------------|
| `heading` | H1-H6 with optional anchor ID |
| `paragraph` | Text with inline formatting (bold, italic, links) |
| `table` | Rows and columns, optional header row styling |
| `list` | Bullet, numbered, or checkbox |
| `image` | Inline from URL or data URI |
| `callout` | Colored box with icon (info, warning, tip) |
| `hr` | Horizontal rule |
| `pageBreak` | Start a new page |

## Development

```bash
pnpm install
pnpm test        # 275 tests
pnpm typecheck   # Strict mode, no errors
pnpm build       # Bundle with esbuild
```

## Architecture

```
src/
├── entrypoint.ts    # CLI
├── normalize.ts     # JSON → internal AST
├── dag/             # AST → batchUpdate requests
│   ├── ir/          # Intermediate representation
│   ├── emit/        # One file per block type
│   └── theme/       # Style application
├── charts/          # SVG generators
└── lib/             # API client, validation, utilities
```

## License

MIT

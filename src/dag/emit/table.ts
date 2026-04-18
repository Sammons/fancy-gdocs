// emitTable — insert table structure + populate cells via emitCell.
//
// Google Docs table layout (segment-relative):
//   tableStart = cursor.getIndex() at entry.
//   After insertTable, table occupies 3 + R*(2*C + 1) indices.
//   cell[r][c] starts at tableStart + 4 + r*(2*C + 1) + c*2.
//
// We iterate cells in REVERSE so that — even though emitCell pushes deferred
// requests — the ordering of the deferred queue is stable and each cell's
// cursor is pinned via withFixedIndex (outer cursor never moves during cell).

import type { TableNode, CellNode } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";
import { emitCell } from "./cell.ts";

export function emitTable(node: TableNode, ctx: EmitContext): void {
  const R = node.rows.length;
  const C = R === 0 ? 0 : node.rows[0].length;
  const tableStart = ctx.cursor.getIndex();

  // Build set of cells covered by merges (excluding anchor cells)
  const coveredCells = new Set<string>();
  if (node.merges) {
    for (const m of node.merges) {
      for (let dr = 0; dr < m.rowSpan; dr++) {
        for (let dc = 0; dc < m.colSpan; dc++) {
          // Skip the anchor cell (top-left of merge region)
          if (dr === 0 && dc === 0) continue;
          coveredCells.add(`${m.row + dr},${m.col + dc}`);
        }
      }
    }
  }

  ctx.pushRequest(
    { insertTable: { rows: R, columns: C, location: { index: tableStart } } },
    ["insertTable.location.index"],
  );

  // Walk cells in FORWARD order because cell content now goes to structure batch.
  // Track cumulative text offset as each cell's insertText shifts subsequent indices.
  let textOffset = 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      // Base cell index from table structure, plus accumulated text from prior cells
      const baseCellIdx = tableStart + 4 + r * (2 * C + 1) + c * 2;
      const cellIdx = baseCellIdx + textOffset;
      const cell = node.rows[r][c];
      // Skip content for cells that will be covered by a merge — they keep their
      // implicit empty paragraph, avoiding fluff newlines after merge concatenation
      if (coveredCells.has(`${r},${c}`)) continue;
      const charsWritten = ctx.cursor.withFixedIndex(cellIdx, () => emitCell(cell, ctx, cellIdx, r));
      textOffset += charsWritten;
    }
  }

  // Table structural length plus all inserted cell text
  const tableStructureLen = 3 + R * (2 * C + 1);
  const tableTotalLen = tableStructureLen + textOffset;
  ctx.cursor.advance(tableTotalLen);

  // Table modification requests use tableStart + 1 because tableStartLocation
  // must point at the TABLE structural element, not the insertion index.
  // Note: deferred requests will be rebased, so we use the base tableStart + 1,
  // not accounting for textOffset here. The rebase pass handles index adjustment.
  const tableStartLoc = tableStart + 1;

  // mergeTableCells — must be deferred (table must exist first)
  if (node.merges) {
    for (const m of node.merges) {
      ctx.pushDeferred(
        {
          mergeTableCells: {
            tableRange: {
              tableCellLocation: {
                tableStartLocation: { index: tableStartLoc },
                rowIndex: m.row,
                columnIndex: m.col,
              },
              rowSpan: m.rowSpan,
              columnSpan: m.colSpan,
            },
          },
        },
        ["mergeTableCells.tableRange.tableCellLocation.tableStartLocation.index"],
      );
    }
  }

  // pinTableHeaderRows — must be deferred (table must exist first)
  if (node.pinnedHeaderRows && node.pinnedHeaderRows > 0) {
    ctx.pushDeferred(
      {
        pinTableHeaderRows: {
          tableStartLocation: { index: tableStartLoc },
          pinnedHeaderRowsCount: node.pinnedHeaderRows,
        },
      },
      ["pinTableHeaderRows.tableStartLocation.index"],
    );
  }

  // updateTableColumnProperties per column — must be deferred (table must exist first)
  if (node.columnWidths) {
    for (let i = 0; i < node.columnWidths.length; i++) {
      ctx.pushDeferred(
        {
          updateTableColumnProperties: {
            tableStartLocation: { index: tableStartLoc },
            columnIndices: [i],
            tableColumnProperties: {
              widthType: "FIXED_WIDTH",
              width: { magnitude: node.columnWidths[i], unit: "PT" },
            },
            fields: "widthType,width",
          },
        },
        ["updateTableColumnProperties.tableStartLocation.index"],
      );
    }
  }

  // per-cell style — must be deferred (table must exist first)
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      pushCellStyle(ctx, node.rows[r][c], tableStartLoc, r, c);
    }
  }

  // Theme-based header row styling (first row gets headerBackground from theme)
  const tableTheme = ctx.theme?.table;
  if (tableTheme?.headerBackground && R > 0 && C > 0) {
    ctx.pushDeferred(
      {
        updateTableCellStyle: {
          tableRange: {
            tableCellLocation: {
              tableStartLocation: { index: tableStartLoc },
              rowIndex: 0,
              columnIndex: 0,
            },
            rowSpan: 1,
            columnSpan: C,
          },
          tableCellStyle: {
            backgroundColor: { color: { rgbColor: hexToRgb(tableTheme.headerBackground) } },
          },
          fields: "backgroundColor",
        },
      },
      ["updateTableCellStyle.tableRange.tableCellLocation.tableStartLocation.index"],
    );
  }

  // noBorder: apply zeroed borders to all cells via a full-table range — must be deferred
  if (node.noBorder && R > 0 && C > 0) {
    const zero = { color: {}, width: { magnitude: 0, unit: "PT" }, dashStyle: "SOLID" };
    ctx.pushDeferred(
      {
        updateTableCellStyle: {
          tableRange: {
            tableCellLocation: {
              tableStartLocation: { index: tableStartLoc },
              rowIndex: 0,
              columnIndex: 0,
            },
            rowSpan: R,
            columnSpan: C,
          },
          tableCellStyle: {
            borderTop: zero, borderBottom: zero, borderLeft: zero, borderRight: zero,
          },
          fields: "borderTop,borderBottom,borderLeft,borderRight",
        },
      },
      ["updateTableCellStyle.tableRange.tableCellLocation.tableStartLocation.index"],
    );
  }
}

function pushCellStyle(ctx: EmitContext, cell: CellNode, tableStart: number, r: number, c: number): void {
  const style: Record<string, unknown> = {};
  const fields: string[] = [];
  if (cell.backgroundColor) {
    style.backgroundColor = { color: { rgbColor: hexToRgb(cell.backgroundColor) } };
    fields.push("backgroundColor");
  }
  if (cell.verticalAlign) {
    style.contentAlignment = cell.verticalAlign;
    fields.push("contentAlignment");
  }
  if (cell.padding != null) {
    const pad = { magnitude: cell.padding, unit: "PT" };
    style.paddingTop = pad; style.paddingBottom = pad; style.paddingLeft = pad; style.paddingRight = pad;
    fields.push("paddingTop", "paddingBottom", "paddingLeft", "paddingRight");
  }
  if (cell.borders) {
    const b = cell.borders;
    if (b.top) { style.borderTop = borderFor(b.top); fields.push("borderTop"); }
    if (b.bottom) { style.borderBottom = borderFor(b.bottom); fields.push("borderBottom"); }
    if (b.left) { style.borderLeft = borderFor(b.left); fields.push("borderLeft"); }
    if (b.right) { style.borderRight = borderFor(b.right); fields.push("borderRight"); }
  }
  if (fields.length === 0) return;
  // Cell style must be deferred (table must exist first)
  ctx.pushDeferred(
    {
      updateTableCellStyle: {
        tableRange: {
          tableCellLocation: {
            tableStartLocation: { index: tableStart },
            rowIndex: r,
            columnIndex: c,
          },
          rowSpan: 1,
          columnSpan: 1,
        },
        tableCellStyle: style,
        fields: fields.join(","),
      },
    },
    ["updateTableCellStyle.tableRange.tableCellLocation.tableStartLocation.index"],
  );
}

function borderFor(hex: string) {
  return {
    color: { color: { rgbColor: hexToRgb(hex) } },
    width: { magnitude: 1, unit: "PT" },
    dashStyle: "SOLID",
  };
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((x) => x + x).join("") : m, 16);
  return { red: ((n >> 16) & 0xff) / 255, green: ((n >> 8) & 0xff) / 255, blue: (n & 0xff) / 255 };
}

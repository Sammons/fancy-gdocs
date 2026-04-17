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

  ctx.pushRequest(
    { insertTable: { rows: R, columns: C, location: { index: tableStart } } },
    ["insertTable.location.index"],
  );

  // Walk cells in reverse; pin cursor at cell-start for each.
  for (let r = R - 1; r >= 0; r--) {
    for (let c = C - 1; c >= 0; c--) {
      const cellIdx = tableStart + 4 + r * (2 * C + 1) + c * 2;
      const cell = node.rows[r][c];
      ctx.cursor.withFixedIndex(cellIdx, () => emitCell(cell, ctx, cellIdx));
    }
  }

  const tableLen = 3 + R * (2 * C + 1);
  ctx.cursor.advance(tableLen);

  // Table modification requests use tableStart + 1 because tableStartLocation
  // must point at the TABLE structural element, not the insertion index.
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

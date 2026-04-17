import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitTable } from "./table.ts";
import type { TableNode, CellNode } from "../types/block.ts";

function cell(text: string, extra: Partial<CellNode> = {}): CellNode {
  return { kind: "cell", children: [{ kind: "paragraph", runs: [{ text }] }], ...extra };
}

function mkCtx(origin: number) {
  const ctx = new EmitContext(new IndexCursor(origin), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  return ctx;
}

test("emitTable 2x2 inserts table + advances cursor + cells deferred", () => {
  const ctx = mkCtx(5);
  const node: TableNode = {
    kind: "table",
    rows: [[cell("a"), cell("b")], [cell("c"), cell("d")]],
  };
  emitTable(node, ctx);
  // 3 + 2*(2*2+1) = 3 + 10 = 13
  assert.equal(ctx.cursor.getIndex(), 5 + 13);
  const ir = ctx.buildIR();
  const local = ir.segments[0].localRequests;
  const deferred = ir.segments[0].deferredRequests;
  // first local is insertTable
  const it = local[0].request as any;
  assert.equal(it.insertTable.rows, 2);
  assert.equal(it.insertTable.columns, 2);
  assert.equal(it.insertTable.location.index, 5);
  // 4 cells, each with a single deferred insertText
  assert.equal(deferred.filter((d) => (d.request as any).insertText).length, 4);
});

test("emitTable 10x10 — cell indexes stay segment-relative; cursor returns to tableStart", () => {
  const ctx = mkCtx(1);
  const rows: CellNode[][] = [];
  for (let r = 0; r < 10; r++) {
    const row: CellNode[] = [];
    for (let c = 0; c < 10; c++) row.push(cell(`r${r}c${c}`));
    rows.push(row);
  }
  emitTable({ kind: "table", rows }, ctx);
  // after emit, cursor advanced by 3 + 10*(2*10+1) = 3 + 210 = 213
  assert.equal(ctx.cursor.getIndex(), 1 + 213);
  const d = ctx.buildIR().segments[0].deferredRequests;
  const inserts = d.filter((x) => (x.request as any).insertText);
  assert.equal(inserts.length, 100);
  // cell[0][0] at index 1 + 4 = 5
  const first = inserts.find((x) => (x.request as any).insertText.text === "r0c0")!;
  assert.equal((first.request as any).insertText.location.index, 5);
  // cell[9][9] at index 1 + 4 + 9*21 + 9*2 = 1 + 4 + 189 + 18 = 212
  const last = inserts.find((x) => (x.request as any).insertText.text === "r9c9")!;
  assert.equal((last.request as any).insertText.location.index, 212);
});

test("emitTable merges → mergeTableCells request (deferred)", () => {
  const ctx = mkCtx(0);
  emitTable({
    kind: "table",
    rows: [[cell("a"), cell("b")], [cell("c"), cell("d")]],
    merges: [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }],
  }, ctx);
  // mergeTableCells is deferred (table must exist first)
  const deferred = ctx.buildIR().segments[0].deferredRequests;
  const merge = deferred.find((r) => (r.request as any).mergeTableCells)!;
  assert.ok(merge);
  const m = (merge.request as any).mergeTableCells;
  assert.equal(m.tableRange.rowSpan, 1);
  assert.equal(m.tableRange.columnSpan, 2);
});

test("emitTable pinnedHeaderRows → pinTableHeaderRows (deferred)", () => {
  const ctx = mkCtx(0);
  emitTable({
    kind: "table",
    rows: [[cell("a")], [cell("b")]],
    pinnedHeaderRows: 1,
  }, ctx);
  // pinTableHeaderRows is deferred (table must exist first)
  const deferred = ctx.buildIR().segments[0].deferredRequests;
  const pin = deferred.find((r) => (r.request as any).pinTableHeaderRows)!;
  assert.ok(pin);
  assert.equal((pin.request as any).pinTableHeaderRows.pinnedHeaderRowsCount, 1);
});

test("emitTable columnWidths → updateTableColumnProperties (deferred)", () => {
  const ctx = mkCtx(0);
  emitTable({
    kind: "table",
    rows: [[cell("a"), cell("b")]],
    columnWidths: [100, 200],
  }, ctx);
  // updateTableColumnProperties is deferred (table must exist first)
  const deferred = ctx.buildIR().segments[0].deferredRequests;
  const cw = deferred.filter((r) => (r.request as any).updateTableColumnProperties);
  assert.equal(cw.length, 2);
  const p0 = (cw[0].request as any).updateTableColumnProperties;
  assert.equal(p0.tableColumnProperties.widthType, "FIXED_WIDTH");
  assert.equal(p0.tableColumnProperties.width.magnitude, 100);
  assert.deepEqual(p0.columnIndices, [0]);
});

test("emitTable noBorder → updateTableCellStyle with 0 width borders (deferred)", () => {
  const ctx = mkCtx(0);
  emitTable({
    kind: "table",
    rows: [[cell("a")]],
    noBorder: true,
  }, ctx);
  // updateTableCellStyle is deferred (table must exist first)
  const deferred = ctx.buildIR().segments[0].deferredRequests;
  const styles = deferred.filter((r) => (r.request as any).updateTableCellStyle);
  assert.ok(styles.length >= 1);
  const s = (styles[0].request as any).updateTableCellStyle;
  assert.equal(s.tableCellStyle.borderTop.width.magnitude, 0);
});

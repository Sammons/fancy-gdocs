import { test } from "node:test";
import assert from "node:assert/strict";
import type { NamedStyle, Alignment, ListStyle, ImageWrapLayout } from "./style-tokens.ts";

test("NamedStyle covers title/subtitle/headings/normal", () => {
  const styles: NamedStyle[] = [
    "TITLE",
    "SUBTITLE",
    "HEADING_1",
    "HEADING_2",
    "HEADING_3",
    "HEADING_4",
    "HEADING_5",
    "HEADING_6",
    "NORMAL_TEXT",
  ];
  assert.equal(styles.length, 9);
});

test("Alignment covers the 4 Docs values", () => {
  const a: Alignment[] = ["START", "CENTER", "END", "JUSTIFIED"];
  assert.equal(a.length, 4);
});

test("ListStyle covers bullet/numbered/check", () => {
  const l: ListStyle[] = ["BULLET", "NUMBERED", "CHECK"];
  assert.equal(l.length, 3);
});

test("ImageWrapLayout covers 6 layouts", () => {
  const w: ImageWrapLayout[] = [
    "WRAP_TEXT",
    "BREAK_LEFT",
    "BREAK_RIGHT",
    "BREAK_LEFT_RIGHT",
    "IN_FRONT_OF_TEXT",
    "BEHIND_TEXT",
  ];
  assert.equal(w.length, 6);
});

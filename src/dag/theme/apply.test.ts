import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTheme } from "./apply.ts";
import type { DocIR } from "../ir/doc-ir.ts";

function ir(requests: Record<string, unknown>[]): DocIR {
  return {
    segments: [{
      localRequests: requests.map((r) => ({ request: r, indexFields: [] })),
      deferredRequests: [],
    }],
  };
}

test("applyTheme fills defaults on updateTextStyle that lacks font/size/color", () => {
  const input = ir([{ updateTextStyle: { textStyle: { bold: true }, fields: "bold" } }]);
  const out = applyTheme(input, { fontFamily: "Inter", fontSize: 11, textColor: "#111" });
  const ts = (out.segments[0].localRequests[0].request as any).updateTextStyle.textStyle;
  assert.equal(ts.weightedFontFamily.fontFamily, "Inter");
  assert.equal(ts.fontSize.magnitude, 11);
  assert.equal(ts.bold, true);
});

test("applyTheme does not override explicit fields", () => {
  const input = ir([{ updateTextStyle: { textStyle: { weightedFontFamily: { fontFamily: "Arial" } }, fields: "weightedFontFamily" } }]);
  const out = applyTheme(input, { fontFamily: "Inter" });
  const ts = (out.segments[0].localRequests[0].request as any).updateTextStyle.textStyle;
  assert.equal(ts.weightedFontFamily.fontFamily, "Arial");
});

test("applyTheme is idempotent", () => {
  const input = ir([{ updateTextStyle: { textStyle: {}, fields: "" } }]);
  const theme = { fontFamily: "Inter", fontSize: 12 };
  const a = applyTheme(input, theme);
  const b = applyTheme(a, theme);
  assert.deepEqual(a, b);
});

test("applyTheme does not mutate input", () => {
  const input = ir([{ updateTextStyle: { textStyle: {}, fields: "" } }]);
  const snapshot = JSON.stringify(input);
  applyTheme(input, { fontFamily: "Inter" });
  assert.equal(JSON.stringify(input), snapshot);
});

// Per-named-style theme tests
function irWithStyle(requests: { req: Record<string, unknown>; namedStyleType?: string }[]): DocIR {
  return {
    segments: [{
      localRequests: [],
      deferredRequests: requests.map((r) => ({
        request: r.req,
        indexFields: [],
        namedStyleType: r.namedStyleType as any,
      })),
    }],
  };
}

test("applyTheme uses per-named-style override for HEADING_1", () => {
  const input = irWithStyle([
    { req: { updateTextStyle: { textStyle: {}, fields: "" } }, namedStyleType: "HEADING_1" },
  ]);
  const out = applyTheme(input, {
    fontFamily: "Inter",
    fontSize: 11,
    textColor: "#333",
    HEADING_1: { fontFamily: "Georgia", fontSize: 18, color: "#1A1A2E" },
  });
  const ts = (out.segments[0].deferredRequests[0].request as any).updateTextStyle.textStyle;
  assert.equal(ts.weightedFontFamily.fontFamily, "Georgia");
  assert.equal(ts.fontSize.magnitude, 18);
  assert.deepEqual(ts.foregroundColor.color.rgbColor, { red: 0.10196078431372549, green: 0.10196078431372549, blue: 0.1803921568627451 });
});

test("applyTheme falls back to global defaults when no per-style override", () => {
  const input = irWithStyle([
    { req: { updateTextStyle: { textStyle: {}, fields: "" } }, namedStyleType: "HEADING_3" },
  ]);
  const out = applyTheme(input, {
    fontFamily: "Inter",
    fontSize: 11,
    headingColor: "#0000FF",
    HEADING_1: { fontFamily: "Georgia", fontSize: 18 },
    // HEADING_3 not defined — should fall back to globals
  });
  const ts = (out.segments[0].deferredRequests[0].request as any).updateTextStyle.textStyle;
  assert.equal(ts.weightedFontFamily.fontFamily, "Inter");
  assert.equal(ts.fontSize.magnitude, 11);
  // Should use headingColor since it's a heading style
  assert.deepEqual(ts.foregroundColor.color.rgbColor, { red: 0, green: 0, blue: 1 });
});

test("applyTheme uses NORMAL_TEXT override for body paragraphs", () => {
  const input = irWithStyle([
    { req: { updateTextStyle: { textStyle: {}, fields: "" } }, namedStyleType: "NORMAL_TEXT" },
  ]);
  const out = applyTheme(input, {
    fontFamily: "Arial",
    fontSize: 12,
    NORMAL_TEXT: { fontFamily: "Times New Roman", fontSize: 14, color: "#111111" },
  });
  const ts = (out.segments[0].deferredRequests[0].request as any).updateTextStyle.textStyle;
  assert.equal(ts.weightedFontFamily.fontFamily, "Times New Roman");
  assert.equal(ts.fontSize.magnitude, 14);
});

test("applyTheme applies bold/italic from per-style override", () => {
  const input = irWithStyle([
    { req: { updateTextStyle: { textStyle: {}, fields: "" } }, namedStyleType: "TITLE" },
  ]);
  const out = applyTheme(input, {
    TITLE: { bold: true, italic: false },
  });
  const ts = (out.segments[0].deferredRequests[0].request as any).updateTextStyle.textStyle;
  assert.equal(ts.bold, true);
  assert.equal(ts.italic, false);
});

test("applyTheme does not apply bold/italic from global theme", () => {
  // bold/italic only come from per-style overrides, not global defaults
  const input = irWithStyle([
    { req: { updateTextStyle: { textStyle: {}, fields: "" } }, namedStyleType: "NORMAL_TEXT" },
  ]);
  const out = applyTheme(input, { fontFamily: "Inter" });
  const ts = (out.segments[0].deferredRequests[0].request as any).updateTextStyle.textStyle;
  assert.equal(ts.bold, undefined);
  assert.equal(ts.italic, undefined);
});

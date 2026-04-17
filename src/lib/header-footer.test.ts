import { describe, it } from "node:test";
import assert from "node:assert";
import { hexToRgb, buildTextStyle, compileHeaderFooterRequests, type Run } from "./header-footer.ts";

describe("hexToRgb", () => {
  it("converts black", () => {
    assert.deepStrictEqual(hexToRgb("#000000"), { red: 0, green: 0, blue: 0 });
  });

  it("converts white", () => {
    assert.deepStrictEqual(hexToRgb("#ffffff"), { red: 1, green: 1, blue: 1 });
  });

  it("converts red", () => {
    assert.deepStrictEqual(hexToRgb("#ff0000"), { red: 1, green: 0, blue: 0 });
  });

  it("converts green", () => {
    assert.deepStrictEqual(hexToRgb("#00ff00"), { red: 0, green: 1, blue: 0 });
  });

  it("converts blue", () => {
    assert.deepStrictEqual(hexToRgb("#0000ff"), { red: 0, green: 0, blue: 1 });
  });

  it("handles hex without hash", () => {
    assert.deepStrictEqual(hexToRgb("ff0000"), { red: 1, green: 0, blue: 0 });
  });

  it("converts mid-gray", () => {
    const result = hexToRgb("#808080");
    assert.ok(Math.abs(result.red - 0.502) < 0.01);
    assert.ok(Math.abs(result.green - 0.502) < 0.01);
    assert.ok(Math.abs(result.blue - 0.502) < 0.01);
  });
});

describe("buildTextStyle", () => {
  it("returns null for plain text run", () => {
    const run: Run = { text: "Hello" };
    assert.strictEqual(buildTextStyle(run), null);
  });

  it("builds bold style", () => {
    const run: Run = { text: "Bold", bold: true };
    const result = buildTextStyle(run);
    assert.strictEqual(result?.style.bold, true);
    assert.strictEqual(result?.fields, "bold");
  });

  it("builds italic style", () => {
    const run: Run = { text: "Italic", italic: true };
    const result = buildTextStyle(run);
    assert.strictEqual(result?.style.italic, true);
    assert.strictEqual(result?.fields, "italic");
  });

  it("builds underline style", () => {
    const run: Run = { text: "Underline", underline: true };
    const result = buildTextStyle(run);
    assert.strictEqual(result?.style.underline, true);
  });

  it("builds strikethrough style", () => {
    const run: Run = { text: "Strike", strikethrough: true };
    const result = buildTextStyle(run);
    assert.strictEqual(result?.style.strikethrough, true);
  });

  it("builds superscript style", () => {
    const run: Run = { text: "2", superscript: true };
    const result = buildTextStyle(run);
    assert.strictEqual(result?.style.baselineOffset, "SUPERSCRIPT");
  });

  it("builds subscript style", () => {
    const run: Run = { text: "2", subscript: true };
    const result = buildTextStyle(run);
    assert.strictEqual(result?.style.baselineOffset, "SUBSCRIPT");
  });

  it("builds fontSize style", () => {
    const run: Run = { text: "Big", fontSize: 24 };
    const result = buildTextStyle(run);
    assert.deepStrictEqual(result?.style.fontSize, { magnitude: 24, unit: "PT" });
  });

  it("builds fontFamily style", () => {
    const run: Run = { text: "Custom", fontFamily: "Arial" };
    const result = buildTextStyle(run);
    assert.deepStrictEqual(result?.style.weightedFontFamily, { fontFamily: "Arial" });
  });

  it("builds foreground color style", () => {
    const run: Run = { text: "Red", color: "#ff0000" };
    const result = buildTextStyle(run);
    assert.deepStrictEqual(result?.style.foregroundColor, {
      color: { rgbColor: { red: 1, green: 0, blue: 0 } },
    });
  });

  it("builds highlight/background color from highlight field", () => {
    const run: Run = { text: "Yellow", highlight: "#ffff00" };
    const result = buildTextStyle(run);
    assert.deepStrictEqual(result?.style.backgroundColor, {
      color: { rgbColor: { red: 1, green: 1, blue: 0 } },
    });
  });

  it("builds highlight/background color from fill field", () => {
    const run: Run = { text: "Yellow", fill: "#ffff00" };
    const result = buildTextStyle(run);
    assert.deepStrictEqual(result?.style.backgroundColor, {
      color: { rgbColor: { red: 1, green: 1, blue: 0 } },
    });
  });

  it("builds link style", () => {
    const run: Run = { text: "Click", link: "https://example.com" };
    const result = buildTextStyle(run);
    assert.deepStrictEqual(result?.style.link, { url: "https://example.com" });
  });

  it("builds smallCaps style", () => {
    const run: Run = { text: "Small", smallCaps: true };
    const result = buildTextStyle(run);
    assert.strictEqual(result?.style.smallCaps, true);
  });

  it("builds fontWeight style", () => {
    const run: Run = { text: "Heavy", fontWeight: 700 };
    const result = buildTextStyle(run);
    assert.deepStrictEqual(result?.style.weightedFontFamily, { fontFamily: "Roboto", weight: 700 });
  });

  it("combines multiple styles", () => {
    const run: Run = { text: "Complex", bold: true, italic: true, fontSize: 18 };
    const result = buildTextStyle(run);
    assert.strictEqual(result?.style.bold, true);
    assert.strictEqual(result?.style.italic, true);
    assert.deepStrictEqual(result?.style.fontSize, { magnitude: 18, unit: "PT" });
    assert.ok(result?.fields.includes("bold"));
    assert.ok(result?.fields.includes("italic"));
    assert.ok(result?.fields.includes("fontSize"));
  });
});

describe("compileHeaderFooterRequests", () => {
  it("returns empty array for empty text", () => {
    const reqs = compileHeaderFooterRequests({ text: "" }, "header-1");
    assert.deepStrictEqual(reqs, []);
  });

  it("compiles simple text spec", () => {
    const reqs = compileHeaderFooterRequests({ text: "Header" }, "header-1");
    assert.strictEqual(reqs.length, 1);
    assert.deepStrictEqual(reqs[0], {
      insertText: { text: "Header", location: { segmentId: "header-1", index: 0 } },
    });
  });

  it("compiles plain runs without style requests", () => {
    const reqs = compileHeaderFooterRequests({ runs: [{ text: "A" }, { text: "B" }] }, "hdr");
    assert.strictEqual(reqs.length, 1);
    const insert = reqs[0] as { insertText: { text: string } };
    assert.strictEqual(insert.insertText.text, "AB");
  });

  it("compiles styled runs with updateTextStyle requests", () => {
    const reqs = compileHeaderFooterRequests(
      { runs: [{ text: "Bold", bold: true }] },
      "header-1"
    );
    assert.strictEqual(reqs.length, 2);
    assert.ok("insertText" in reqs[0]);
    assert.ok("updateTextStyle" in reqs[1]);
    const style = reqs[1] as { updateTextStyle: { range: { startIndex: number; endIndex: number }; textStyle: { bold: boolean } } };
    assert.strictEqual(style.updateTextStyle.range.startIndex, 0);
    assert.strictEqual(style.updateTextStyle.range.endIndex, 4);
    assert.strictEqual(style.updateTextStyle.textStyle.bold, true);
  });

  it("compiles multiple styled runs with correct ranges", () => {
    const reqs = compileHeaderFooterRequests(
      { runs: [{ text: "A", bold: true }, { text: "B", italic: true }] },
      "hdr"
    );
    assert.strictEqual(reqs.length, 3);
    const style1 = reqs[1] as { updateTextStyle: { range: { startIndex: number; endIndex: number } } };
    const style2 = reqs[2] as { updateTextStyle: { range: { startIndex: number; endIndex: number } } };
    assert.strictEqual(style1.updateTextStyle.range.startIndex, 0);
    assert.strictEqual(style1.updateTextStyle.range.endIndex, 1);
    assert.strictEqual(style2.updateTextStyle.range.startIndex, 1);
    assert.strictEqual(style2.updateTextStyle.range.endIndex, 2);
  });

  it("uses segmentId in all requests", () => {
    const reqs = compileHeaderFooterRequests(
      { runs: [{ text: "X", bold: true }] },
      "footer-1"
    );
    const insert = reqs[0] as { insertText: { location: { segmentId: string } } };
    const style = reqs[1] as { updateTextStyle: { range: { segmentId: string } } };
    assert.strictEqual(insert.insertText.location.segmentId, "footer-1");
    assert.strictEqual(style.updateTextStyle.range.segmentId, "footer-1");
  });
});

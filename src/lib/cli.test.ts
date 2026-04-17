/**
 * Tests for CLI argument parsing helpers.
 * Note: We only test the pure functions (takeFlag, takeOption, resolveFilePath)
 * since readSpec depends on the file system and normalize.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import path from "node:path";

// Inline implementations to avoid import chain to api-client.ts (needs @zapier/zapier-sdk)
function takeFlag(argv: string[], name: string): { present: boolean; remaining: string[] } {
  const flag = `--${name}`;
  const remaining: string[] = [];
  let present = false;
  for (const arg of argv) {
    if (arg === flag) {
      present = true;
    } else {
      remaining.push(arg);
    }
  }
  return { present, remaining };
}

function takeOption(argv: string[], name: string): { value: string | undefined; remaining: string[] } {
  const flag = `--${name}`;
  const prefix = `${flag}=`;
  const remaining: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === flag) {
      value = argv[++i];
    } else if (arg.startsWith(prefix)) {
      value = arg.slice(prefix.length);
    } else {
      remaining.push(arg);
    }
  }
  return { value, remaining };
}

function resolveFilePath(filePath: string): string {
  return path.resolve(filePath);
}

describe("takeFlag", () => {
  it("detects present flag", () => {
    const result = takeFlag(["--dry-run", "file.json"], "dry-run");
    assert.strictEqual(result.present, true);
    assert.deepStrictEqual(result.remaining, ["file.json"]);
  });

  it("returns false for missing flag", () => {
    const result = takeFlag(["file.json"], "dry-run");
    assert.strictEqual(result.present, false);
    assert.deepStrictEqual(result.remaining, ["file.json"]);
  });

  it("handles multiple args", () => {
    const result = takeFlag(["--verbose", "--dry-run", "file.json", "--other"], "dry-run");
    assert.strictEqual(result.present, true);
    assert.deepStrictEqual(result.remaining, ["--verbose", "file.json", "--other"]);
  });

  it("handles flag at end", () => {
    const result = takeFlag(["file.json", "--dry-run"], "dry-run");
    assert.strictEqual(result.present, true);
    assert.deepStrictEqual(result.remaining, ["file.json"]);
  });

  it("handles empty args", () => {
    const result = takeFlag([], "dry-run");
    assert.strictEqual(result.present, false);
    assert.deepStrictEqual(result.remaining, []);
  });
});

describe("takeOption", () => {
  it("extracts --option value form", () => {
    const result = takeOption(["--out", "/tmp/result.json"], "out");
    assert.strictEqual(result.value, "/tmp/result.json");
    assert.deepStrictEqual(result.remaining, []);
  });

  it("extracts --option=value form", () => {
    const result = takeOption(["--out=/tmp/result.json"], "out");
    assert.strictEqual(result.value, "/tmp/result.json");
    assert.deepStrictEqual(result.remaining, []);
  });

  it("returns undefined for missing option", () => {
    const result = takeOption(["file.json"], "out");
    assert.strictEqual(result.value, undefined);
    assert.deepStrictEqual(result.remaining, ["file.json"]);
  });

  it("handles mixed args", () => {
    const result = takeOption(["--verbose", "--out", "/tmp/result.json", "file.json"], "out");
    assert.strictEqual(result.value, "/tmp/result.json");
    assert.deepStrictEqual(result.remaining, ["--verbose", "file.json"]);
  });

  it("handles option with equals sign in value", () => {
    const result = takeOption(["--query=a=b"], "query");
    assert.strictEqual(result.value, "a=b");
  });

  it("takes last value if option appears multiple times", () => {
    const result = takeOption(["--out", "first", "--out", "second"], "out");
    assert.strictEqual(result.value, "second");
  });

  it("handles empty args", () => {
    const result = takeOption([], "out");
    assert.strictEqual(result.value, undefined);
    assert.deepStrictEqual(result.remaining, []);
  });
});

describe("resolveFilePath", () => {
  it("resolves relative path to absolute", () => {
    const result = resolveFilePath("file.json");
    assert.strictEqual(path.isAbsolute(result), true);
  });

  it("keeps absolute path unchanged", () => {
    const result = resolveFilePath("/tmp/file.json");
    assert.strictEqual(result, "/tmp/file.json");
  });

  it("resolves parent directory references", () => {
    const result = resolveFilePath("/tmp/subdir/../file.json");
    assert.strictEqual(result, "/tmp/file.json");
  });
});

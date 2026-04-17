// CLI argument parsing helpers.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { DocSpec } from "../dag/index.ts";
import { normalizeSpec, needsNormalization } from "../normalize.ts";
import { fail } from "./api-client.ts";

export function readSpec(filePath: string): DocSpec {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    // Normalize type-based DSL to kind-based format if needed
    if (needsNormalization(parsed)) {
      return normalizeSpec(parsed);
    }
    return parsed;
  } catch (err: any) {
    fail(`Error reading DSL file at ${filePath}: ${err.message}`);
  }
}

export function takeFlag(argv: string[], name: string): { present: boolean; remaining: string[] } {
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

export function takeOption(argv: string[], name: string): { value: string | undefined; remaining: string[] } {
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

export function resolveFilePath(filePath: string): string {
  return path.resolve(filePath);
}

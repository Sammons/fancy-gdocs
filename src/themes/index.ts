// Theme presets for gdocs skill.
// Usage: import { loadTheme, THEME_NAMES } from "./themes/index.ts"

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ThemePreset {
  name: string;
  description: string;
  theme: Record<string, unknown>;
  documentStyle?: Record<string, unknown>;
  calloutPresets?: Record<string, { fill: string; borderColor: string }>;
  tableHeaderStyle?: { fill: string; textColor: string; bold?: boolean };
  paragraphDefaults?: { lineSpacing?: number; firstLineIndent?: number };
  bibliographyStyle?: { lineSpacing?: number; hangingIndent?: number };
  codeBlockStyle?: {
    fontFamily: string;
    fontSize: number;
    colors: Record<string, string>;
  };
}

export const THEME_NAMES = ["corporate", "dark-mode", "academic"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

const themeCache = new Map<ThemeName, ThemePreset>();

/**
 * Load a theme preset by name.
 * Themes are JSON files in the themes/ directory.
 */
export function loadTheme(name: ThemeName): ThemePreset {
  const cached = themeCache.get(name);
  if (cached) return cached;

  const themePath = path.join(__dirname, `${name}.json`);
  const raw = readFileSync(themePath, "utf8");
  const preset = JSON.parse(raw) as ThemePreset;
  themeCache.set(name, preset);
  return preset;
}

/**
 * Check if a string is a valid theme name.
 */
export function isThemeName(name: string): name is ThemeName {
  return THEME_NAMES.includes(name as ThemeName);
}

/**
 * Apply a theme preset to a doc spec.
 * Merges theme properties into the spec, with spec values taking precedence.
 */
export function applyThemePreset(
  spec: { theme?: unknown; docStyle?: unknown },
  preset: ThemePreset,
): void {
  // Merge theme (spec takes precedence)
  const existingTheme = (spec.theme ?? {}) as Record<string, unknown>;
  spec.theme = { ...preset.theme, ...existingTheme };

  // Merge documentStyle (spec takes precedence)
  if (preset.documentStyle) {
    const existingDocStyle = (spec.docStyle ?? {}) as Record<string, unknown>;
    spec.docStyle = { ...preset.documentStyle, ...existingDocStyle };
  }
}

/**
 * Color palette and assignment logic for charts
 */

import type { PieSlice } from "./types.ts";

/**
 * Accessible, WCAG AA compliant palette with sufficient contrast.
 * Colors assigned in order when not explicitly specified.
 */
export const PALETTE = [
  "#4285F4", // Google Blue
  "#EA4335", // Google Red
  "#FBBC05", // Google Yellow
  "#34A853", // Google Green
  "#FF6D01", // Orange
  "#46BDC6", // Teal
  "#7B1FA2", // Purple
  "#C2185B", // Pink
  "#5E35B1", // Deep Purple
  "#00897B", // Dark Teal
];

/**
 * Assign colors to data items that don't have explicit colors.
 * Wraps palette if more items than colors.
 */
export function assignColors<T extends { color?: string }>(
  data: T[],
  palette: string[] = PALETTE
): (T & { color: string })[] {
  let colorIndex = 0;
  return data.map((item) => {
    if (item.color) {
      return item as T & { color: string };
    }
    const color = palette[colorIndex % palette.length];
    colorIndex++;
    return { ...item, color };
  });
}

/**
 * Assign colors specifically to pie slices.
 */
export function assignPieColors(
  slices: PieSlice[],
  palette: string[] = PALETTE
): (PieSlice & { color: string })[] {
  return assignColors(slices, palette);
}

/**
 * Convert hex color to RGB components.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB components to hex color.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Color utility functions
 */

/**
 * Expand color according to convention:
 * 1 digit -> repeat 6 times (2 -> 222222)
 * 2 digits -> repeat 3 times (20 -> 202020)
 * 3 digits -> duplicate each digit (123 -> 112233)
 * 4+ digits -> return as is (should be 6 for RGB)
 * 
 * @param hex Hex color string (with or without # prefix)
 * @returns Expanded 6-digit hex color (without # prefix, uppercase)
 */
export function expandColor(hex: string): string {
  if (!hex) return '';
  // Remove # if present and convert to uppercase
  const cleaned = hex.replace(/^#/, '').toUpperCase();
  if (cleaned.length === 1) {
    // 1 digit -> repeat 6 times
    return cleaned.repeat(6);
  } else if (cleaned.length === 2) {
    // 2 digits -> repeat 3 times
    return cleaned.repeat(3);
  } else if (cleaned.length === 3) {
    // 3 digits -> duplicate each digit
    return cleaned.split('').map(c => c + c).join('');
  }
  // 4+ digits -> return as is (should be 6 for RGB)
  return cleaned;
}

/**
 * Result of parsing a color with optional alpha
 */
export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number; // 0-1
}

/**
 * Parse hex6 (#RRGGBB) or hex8 (#RRGGBBAA) into rgba components.
 * Hex6 defaults to alpha 1.
 *
 * @param hex Color string with or without # prefix
 * @returns Parsed color with r,g,b,a in 0-1 range
 */
export function parseColorWithAlpha(hex: string): ParsedColor {
  const cleaned = hex.replace(/^#/, '').toUpperCase();
  const rgb = expandColor(cleaned.substring(0, 6));
  if (!rgb || rgb.length < 6) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  const r = parseInt(rgb.substring(0, 2), 16) / 255;
  const g = parseInt(rgb.substring(2, 4), 16) / 255;
  const b = parseInt(rgb.substring(4, 6), 16) / 255;
  let a = 1;
  if (cleaned.length >= 8) {
    const alphaHex = cleaned.substring(6, 8);
    a = parseInt(alphaHex, 16) / 255;
  } else if (cleaned.length === 7) {
    // 7 chars = typo, treat as 6
    a = 1;
  }
  return { r, g, b, a };
}

/**
 * Convert rgba (0-1) to hex8 string.
 *
 * @param r Red 0-1
 * @param g Green 0-1
 * @param b Blue 0-1
 * @param a Alpha 0-1
 * @returns Hex8 string with # prefix (e.g., "#FF000080")
 */
export function rgbaToHex8(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number) => {
    const clamped = Math.round(Math.max(0, Math.min(1, n)) * 255);
    return clamped.toString(16).padStart(2, '0').toUpperCase();
  };
  return '#' + toHex(r) + toHex(g) + toHex(b) + toHex(a);
}

/**
 * Convert hex6 or hex8 to rgba string for CSS.
 *
 * @param hex Color string (#RRGGBB or #RRGGBBAA)
 * @returns rgba(r, g, b, a) CSS string
 */
export function hexToRgbaCss(hex: string): string {
  const { r, g, b, a } = parseColorWithAlpha(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

/**
 * Normalize color to hex8. Hex6 becomes hex8 with FF alpha.
 *
 * @param hex Color string (#RRGGBB or #RRGGBBAA)
 * @returns Hex8 string with # prefix
 */
export function toHex8(hex: string): string {
  const { r, g, b, a } = parseColorWithAlpha(hex);
  return rgbaToHex8(r, g, b, a);
}


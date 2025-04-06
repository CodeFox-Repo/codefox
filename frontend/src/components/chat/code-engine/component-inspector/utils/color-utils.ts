/**
 * Utility functions for color manipulation and conversion
 */

import { ComputedStyles, CustomStyles } from '../types';

/**
 * Converts RGB/RGBA string to HEX format
 * @param rgbStr - RGB or RGBA color string (e.g., "rgb(255, 0, 0)" or "rgba(255, 0, 0, 0.5)")
 * @returns HEX color string (e.g., "#ff0000")
 */
export const rgbToHex = (rgbStr: string): string => {
  if (!rgbStr) return '';
  if (rgbStr.startsWith('#')) return rgbStr;

  // Extract RGB/RGBA values
  const rgbMatch = rgbStr.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
  );
  if (!rgbMatch) return rgbStr;

  const r = parseInt(rgbMatch[1], 10);
  const g = parseInt(rgbMatch[2], 10);
  const b = parseInt(rgbMatch[3], 10);

  // Convert to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * Gets a color value from styles, converting to HEX when needed
 * @param style - The style value (could be RGB, RGBA, or HEX)
 * @param fallback - Fallback color to use if style is empty
 * @returns Normalized HEX color
 */
export const getColorValue = (
  style: string,
  fallback: string = '#000000'
): string => {
  if (!style) return fallback;
  return rgbToHex(style);
};

/**
 * Parse RGBA color string into components
 * @param rgba - RGBA color string (e.g., "rgba(255, 0, 0, 0.5)")
 * @returns Object with r, g, b, a components
 */
export const parseRgba = (
  rgba: string
): { r: number; g: number; b: number; a: number } | null => {
  if (!rgba) return null;

  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;

  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    a: match[4] ? parseFloat(match[4]) : 1,
  };
};

/**
 * Determine if a color is light or dark
 * @param color - Color in any format (HEX, RGB, RGBA)
 * @returns true if the color is light, false if dark
 */
export const isLightColor = (color: string): boolean => {
  let r, g, b;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    const rgba = parseRgba(color);
    if (!rgba) return true; // Default to light if parsing fails
    r = rgba.r;
    g = rgba.g;
    b = rgba.b;
  }

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
};

/**
 * Get a color value from custom or computed styles
 * @param style - Style property name
 * @param customStyles - Custom styles object
 * @param computedStyles - Computed styles object
 * @param fallback - Fallback color
 * @returns Color value
 */
export const getStyleColor = (
  style: string,
  customStyles: CustomStyles,
  computedStyles: ComputedStyles | null,
  fallback: string = '#000000'
): string => {
  const color =
    customStyles[style] ||
    (computedStyles && computedStyles[style]) ||
    fallback;
  return getColorValue(color, fallback);
};

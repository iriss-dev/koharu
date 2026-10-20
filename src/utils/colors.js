/**
 * Utility functions for parsing, validating, and blending hex colors.
 */

const HEX_REGEX = /^#?([0-9a-fA-F]{6})$/;

/**
 * Validates whether a string is a valid 6-character hex color.
 * @param {string} input
 * @returns {boolean}
 */
function isValidHex(input) {
  if (!input || typeof input !== 'string') return false;
  return HEX_REGEX.test(input.trim());
}

/**
 * Normalizes a hex string to uppercase with a leading '#'.
 * @param {string} input
 * @returns {string}
 */
function normalizeHex(input) {
  const clean = input.trim().replace(/^#/, '').toUpperCase();
  return `#${clean}`;
}

/**
 * Converts a hex string into an { r, g, b } object.
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
  const clean = hex.replace(/^#/, '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts { r, g, b } components back to a '#RRGGBB' hex string.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v) => clamp(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Blends two hex colors together at ratio t (0.0 to 1.0).
 * Useful for dual-color booster perks where Discord supports 1 native role color.
 * @param {string} hex1
 * @param {string} hex2
 * @param {number} t (default 0.5)
 * @returns {string}
 */
function blendColors(hex1, hex2, t = 0.5) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);

  const r = c1.r + (c2.r - c1.r) * t;
  const g = c1.g + (c2.g - c1.g) * t;
  const b = c1.b + (c2.b - c1.b) * t;

  return rgbToHex(r, g, b);
}

/**
 * Generates an ASCII color swatch preview for Discord embeds.
 * @param {string} hex1
 * @param {string|null} hex2
 * @returns {string}
 */
function getDualColorPreview(hex1, hex2 = null) {
  if (!hex2) {
    return `\`${normalizeHex(hex1)}\``;
  }
  const mid = blendColors(hex1, hex2, 0.5);
  return `\`${normalizeHex(hex1)}\` ➔ \`${mid}\` ➔ \`${normalizeHex(hex2)}\``;
}

module.exports = {
  isValidHex,
  normalizeHex,
  hexToRgb,
  rgbToHex,
  blendColors,
  getDualColorPreview,
};

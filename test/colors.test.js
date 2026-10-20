const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidHex,
  normalizeHex,
  hexToRgb,
  rgbToHex,
  blendColors,
  getDualColorPreview,
} = require('../src/utils/colors');

describe('Color Utilities', () => {
  test('isValidHex identifies valid 6-char hex colors', () => {
    assert.equal(isValidHex('#F472B6'), true);
    assert.equal(isValidHex('F472B6'), true);
    assert.equal(isValidHex('#ffffff'), true);
    assert.equal(isValidHex('#000000'), true);
  });

  test('isValidHex rejects malformed hex codes', () => {
    assert.equal(isValidHex(''), false);
    assert.equal(isValidHex('#FFF'), false);
    assert.equal(isValidHex('ZZZZZZ'), false);
    assert.equal(isValidHex(null), false);
    assert.equal(isValidHex('#1234567'), false);
  });

  test('normalizeHex standardizes uppercase with # prefix', () => {
    assert.equal(normalizeHex('f472b6'), '#F472B6');
    assert.equal(normalizeHex('#f472b6'), '#F472B6');
  });

  test('hexToRgb and rgbToHex convert accurately', () => {
    const rgb = hexToRgb('#FF8000');
    assert.deepEqual(rgb, { r: 255, g: 128, b: 0 });

    const hex = rgbToHex(255, 128, 0);
    assert.equal(hex, '#FF8000');
  });

  test('blendColors calculates exact midpoint for booster gradient', () => {
    // Black (#000000) and White (#FFFFFF) midpoint is #808080
    const mid = blendColors('#000000', '#FFFFFF', 0.5);
    assert.equal(mid, '#808080');

    // Soft Pink #F472B6 and Lavender #A78BFA
    const blended = blendColors('#F472B6', '#A78BFA', 0.5);
    assert.equal(typeof blended, 'string');
    assert.match(blended, /^#[0-9A-F]{6}$/);
  });

  test('getDualColorPreview formats dual swatch cleanly', () => {
    const preview = getDualColorPreview('#F472B6', '#A78BFA');
    assert.ok(preview.includes('#F472B6'));
    assert.ok(preview.includes('#A78BFA'));
    assert.ok(preview.includes('➔'));
  });
});

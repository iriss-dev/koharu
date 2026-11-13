'use strict';

/**
 * Dependency-free PNG encoder for colour swatches (palettes, role previews).
 * Draws anti-aliased rounded rectangles on a transparent canvas.
 */

const zlib = require('zlib');
const { hexToRgb } = require('./colors');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** Encodes RGBA pixels (Uint8Array, width*height*4) as a PNG buffer. */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 4);
  }

  /** Alpha-blends a colour onto a pixel with coverage 0..1. */
  blend(x, y, { r, g, b }, coverage) {
    if (coverage <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const a = Math.min(1, coverage);
    const dstA = this.pixels[i + 3] / 255;
    const outA = a + dstA * (1 - a);
    const mix = (src, dst) => (src * a + dst * dstA * (1 - a)) / (outA || 1);
    this.pixels[i] = Math.round(mix(r, this.pixels[i]));
    this.pixels[i + 1] = Math.round(mix(g, this.pixels[i + 1]));
    this.pixels[i + 2] = Math.round(mix(b, this.pixels[i + 2]));
    this.pixels[i + 3] = Math.round(outA * 255);
  }

  /** Anti-aliased rounded rectangle; `fill` may be one colour or [left, right] for a gradient. */
  roundRect(x0, y0, w, h, radius, fill) {
    const [left, right] = Array.isArray(fill) ? fill.map(hexToRgb) : [hexToRgb(fill), hexToRgb(fill)];
    const r = Math.min(radius, w / 2, h / 2);
    for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
        // signed distance to the rounded rectangle, sampled at the pixel centre
        const px = x + 0.5, py = y + 0.5;
        const qx = Math.abs(px - (x0 + w / 2)) - (w / 2 - r);
        const qy = Math.abs(py - (y0 + h / 2)) - (h / 2 - r);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
        const coverage = Math.max(0, Math.min(1, 0.5 - outside));
        if (coverage === 0) continue;
        const t = w > 1 ? (px - x0) / w : 0;
        const color = {
          r: left.r + (right.r - left.r) * t,
          g: left.g + (right.g - left.g) * t,
          b: left.b + (right.b - left.b) * t,
        };
        this.blend(x, y, color, coverage);
      }
    }
  }

  toPng() {
    return encodePng(this.width, this.height, this.pixels);
  }
}

/**
 * Rows of rounded swatches, e.g. a palette (one row) or several harmonies.
 * @param {string[][]} rows hex colours per row
 */
function swatchRows(rows, { width = 640, rowHeight = 96, gap = 14, padding = 16, radius = 22 } = {}) {
  const height = padding * 2 + rows.length * rowHeight + (rows.length - 1) * gap;
  const canvas = new Canvas(width, height);
  rows.forEach((colors, rowIndex) => {
    const y = padding + rowIndex * (rowHeight + gap);
    const count = colors.length;
    const swatchWidth = (width - padding * 2 - gap * (count - 1)) / count;
    colors.forEach((hex, i) => {
      canvas.roundRect(padding + i * (swatchWidth + gap), y, swatchWidth, rowHeight, radius, hex);
    });
  });
  return canvas.toPng();
}

/** One wide pill showing a solid colour or a two-colour gradient (role previews). */
function rolePreview(primary, secondary = null, { width = 640, height = 120 } = {}) {
  const canvas = new Canvas(width, height);
  canvas.roundRect(12, 12, width - 24, height - 24, (height - 24) / 2, secondary ? [primary, secondary] : primary);
  return canvas.toPng();
}

module.exports = { encodePng, crc32, Canvas, swatchRows, rolePreview };

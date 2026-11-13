'use strict';

/**
 * Koharu emoji set. Every emoji is a 128 × 128 SVG drawn with the same rules so
 * the set reads as one family at Discord's inline size (22 px) and jumbo size
 * (48 px): a plum outline, a two-stop pastel gradient and a soft white highlight.
 *
 * Render to PNG with `npm run emojis:render` (see scripts/emojis/render.js).
 */

const O = '#5B2A45'; // outline
const SW = 5; // outline width

let gradientSeq = 0;

function grad(top, bottom) {
  const id = `g${gradientSeq++}`;
  return {
    id,
    def: `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`,
    fill: `url(#${id})`,
  };
}

function svg(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><defs>${defs.join('')}</defs><g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}

const stroke = `stroke="${O}" stroke-width="${SW}"`;
const shine = (cx, cy, rx, ry, rot = -30) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="0.75" transform="rotate(${rot} ${cx} ${cy})"/>`;
const dot = (cx, cy, r, color = '#fff', opacity = 1) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}"/>`;

function petals(count, path, fill, extra = '') {
  let out = '';
  for (let i = 0; i < count; i++) {
    out += `<path d="${path}" fill="${fill}" ${stroke} transform="rotate(${(360 / count) * i} 64 64)" ${extra}/>`;
  }
  return out;
}

function circleBadge(top, bottom, inner) {
  const g = grad(top, bottom);
  return svg([g.def], `<circle cx="64" cy="64" r="54" fill="${g.fill}" ${stroke}/>${shine(44, 36, 16, 8)}${inner}`);
}

const designs = {
  sakura() {
    const g = grad('#FFD3E3', '#FF8DB8');
    const petal = 'M64 64 C 42 52, 38 24, 55 13 L 64 22 L 73 13 C 90 24, 86 52, 64 64 Z';
    return svg([g.def],
      petals(5, petal, g.fill) +
      `<circle cx="64" cy="64" r="11" fill="#FFE08A" ${stroke}/>` +
      [0, 72, 144, 216, 288].map(a => `<circle cx="64" cy="44" r="3.2" fill="#E2457E" transform="rotate(${a} 64 64)"/>`).join('') +
      shine(50, 28, 7, 4, -50));
  },

  tulip() {
    const g = grad('#FFB3C7', '#F2668F');
    const leaf = grad('#B8F0C8', '#5CC98A');
    return svg([g.def, leaf.def],
      `<path d="M64 74 L64 118" stroke="${O}" stroke-width="13"/><path d="M64 74 L64 118" stroke="#6BCB8B" stroke-width="5"/>` +
      `<path d="M64 112 C 46 108, 34 94, 30 76 C 48 80, 60 92, 64 112 Z" fill="${leaf.fill}" ${stroke}/>` +
      `<path d="M64 112 C 82 108, 94 94, 98 78 C 80 82, 68 94, 64 112 Z" fill="${leaf.fill}" ${stroke}/>` +
      `<path d="M36 34 C 36 64, 46 80, 64 80 C 82 80, 92 64, 92 34 L 78 46 L 64 20 L 50 46 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M50 46 C 54 60, 58 70, 64 74" fill="none" stroke="${O}" stroke-width="3" opacity="0.45"/>` +
      `<path d="M78 46 C 74 60, 70 70, 64 74" fill="none" stroke="${O}" stroke-width="3" opacity="0.45"/>` +
      shine(46, 48, 4, 10, 10));
  },

  daisy() {
    const g = grad('#FFFFFF', '#F3E6FF');
    const petal = 'M64 64 C 56 48, 56 22, 64 12 C 72 22, 72 48, 64 64 Z';
    return svg([g.def],
      petals(10, petal, g.fill) +
      `<circle cx="64" cy="64" r="17" fill="#FFD45C" ${stroke}/>` +
      dot(58, 58, 4, '#fff', 0.8) + dot(70, 66, 2.5, '#E8A93A') + dot(62, 71, 2.5, '#E8A93A') + dot(71, 57, 2, '#E8A93A'));
  },

  heart() {
    const g = grad('#FFA8CB', '#F2558F');
    return svg([g.def],
      `<path d="M64 112 C 22 84, 10 58, 22 38 C 34 18, 56 20, 64 40 C 72 20, 94 18, 106 38 C 118 58, 106 84, 64 112 Z" fill="${g.fill}" ${stroke}/>` +
      shine(38, 44, 10, 6, -40) + dot(52, 34, 3.5, '#fff', 0.8));
  },

  hearts() {
    const a = grad('#FFA8CB', '#F2558F');
    const b = grad('#E2D2FF', '#A985F5');
    const h = (x, y, s, fill) =>
      `<path transform="translate(${x} ${y}) scale(${s})" d="M64 112 C 22 84, 10 58, 22 38 C 34 18, 56 20, 64 40 C 72 20, 94 18, 106 38 C 118 58, 106 84, 64 112 Z" fill="${fill}" stroke="${O}" stroke-width="${SW / s}"/>`;
    return svg([a.def, b.def],
      h(44, 6, 0.62, b.fill) + h(-2, 34, 0.72, a.fill) + shine(26, 64, 6, 4, -40) + shine(72, 30, 5, 3, -40));
  },

  sparkle() {
    const g = grad('#FFF1A8', '#FFC34D');
    const p = grad('#FFC9DD', '#FF8DB8');
    return svg([g.def, p.def],
      `<path d="M58 14 C 62 46, 76 60, 108 64 C 76 68, 62 82, 58 114 C 54 82, 40 68, 8 64 C 40 60, 54 46, 58 14 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M100 10 C 102 22, 106 26, 118 28 C 106 30, 102 34, 100 46 C 98 34, 94 30, 82 28 C 94 26, 98 22, 100 10 Z" fill="${p.fill}" stroke="${O}" stroke-width="4"/>` +
      shine(50, 50, 4, 8, 20));
  },

  star() {
    const g = grad('#FFF0A0', '#FFBE3D');
    return svg([g.def],
      `<path d="M64 12 L 79 44 L 114 48 L 88 72 L 95 107 L 64 90 L 33 107 L 40 72 L 14 48 L 49 44 Z" fill="${g.fill}" ${stroke} stroke-linejoin="round"/>` +
      `<circle cx="54" cy="66" r="3.5" fill="${O}"/><circle cx="74" cy="66" r="3.5" fill="${O}"/>` +
      `<path d="M59 75 Q 64 80, 69 75" fill="none" stroke="${O}" stroke-width="3"/>` +
      dot(47, 74, 4, '#FF8DB8', 0.7) + dot(81, 74, 4, '#FF8DB8', 0.7) + shine(56, 38, 6, 3, -60));
  },

  ribbon() {
    const g = grad('#FFC2DA', '#F2669A');
    return svg([g.def],
      `<path d="M58 70 L 40 112 L 52 106 L 58 118 L 66 76 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M70 70 L 88 112 L 76 106 L 70 118 L 62 76 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M60 58 C 40 30, 12 30, 12 56 C 12 80, 40 82, 60 66 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M68 58 C 88 30, 116 30, 116 56 C 116 80, 88 82, 68 66 Z" fill="${g.fill}" ${stroke}/>` +
      `<rect x="52" y="50" width="24" height="24" rx="9" fill="#FF8DB8" ${stroke}/>` +
      shine(30, 48, 8, 4, -30) + shine(98, 48, 8, 4, 30));
  },

  dress() {
    const g = grad('#E9DCFF', '#B394F7');
    const s = grad('#FFC2DA', '#F2669A');
    return svg([g.def, s.def],
      `<path d="M52 16 L 54 40 M76 16 L 74 40" ${stroke}/>` +
      `<path d="M50 38 C 46 46, 44 54, 46 62 L 82 62 C 84 54, 82 46, 78 38 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M46 62 C 36 80, 24 100, 18 114 C 48 122, 80 122, 110 114 C 104 100, 92 80, 82 62 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M30 102 Q 40 110, 50 104 Q 60 112, 70 104 Q 80 112, 90 104 Q 100 110, 104 104" fill="none" stroke="#fff" stroke-width="3.5" opacity="0.8"/>` +
      `<rect x="44" y="56" width="40" height="11" rx="5" fill="${s.fill}" ${stroke}/>` +
      `<circle cx="64" cy="61.5" r="5" fill="#FF8DB8" stroke="${O}" stroke-width="3"/>` +
      shine(56, 48, 3, 6, 0));
  },

  bag() {
    const g = grad('#FFC9DD', '#F27AA8');
    return svg([g.def],
      `<path d="M46 46 C 46 20, 82 20, 82 46" fill="none" ${stroke} stroke-width="7"/>` +
      `<path d="M24 44 L 104 44 L 98 112 C 98 116, 94 118, 90 118 L 38 118 C 34 118, 30 116, 30 112 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M64 98 C 48 88, 46 76, 52 70 C 57 66, 62 68, 64 73 C 66 68, 71 66, 76 70 C 82 76, 80 88, 64 98 Z" fill="#fff" stroke="${O}" stroke-width="3.5"/>` +
      shine(40, 58, 4, 10, 10));
  },

  coin() {
    const g = grad('#FFE89A', '#F5B53B');
    const petal = 'M64 64 C 52 57, 50 42, 59 36 L 64 41 L 69 36 C 78 42, 76 57, 64 64 Z';
    let flower = '';
    for (let i = 0; i < 5; i++) flower += `<path d="${petal}" fill="#E39A24" transform="rotate(${72 * i} 64 64)"/>`;
    return svg([g.def],
      `<circle cx="64" cy="64" r="52" fill="${g.fill}" ${stroke}/>` +
      `<circle cx="64" cy="64" r="39" fill="none" stroke="#E39A24" stroke-width="4"/>` +
      flower + dot(64, 64, 5, '#FFE89A') + shine(42, 34, 12, 6));
  },

  piggy() {
    const g = grad('#FFD1E1', '#F78DB4');
    return svg([g.def],
      `<path d="M44 92 L 44 110 L 56 110 L 56 96 Z M74 96 L 74 110 L 86 110 L 86 92 Z" fill="#F78DB4" ${stroke}/>` +
      `<ellipse cx="64" cy="70" rx="46" ry="36" fill="${g.fill}" ${stroke}/>` +
      `<path d="M40 42 L 34 20 L 56 34 Z" fill="#F78DB4" ${stroke}/>` +
      `<ellipse cx="104" cy="74" rx="12" ry="14" fill="#FFB3CC" ${stroke}/>` +
      dot(101, 70, 2.8, O) + dot(101, 79, 2.8, O) +
      dot(80, 58, 4, O) + dot(78, 56, 1.4) +
      `<rect x="50" y="36" width="26" height="7" rx="3.5" fill="${O}"/>` +
      `<path d="M18 70 C 8 66, 10 56, 18 58" fill="none" ${stroke}/>` +
      dot(88, 76, 5, '#FF7AA8', 0.6) + shine(42, 56, 12, 6));
  },

  key() {
    const g = grad('#FFE89A', '#F5B53B');
    return svg([g.def],
      `<path d="M58 66 L 106 66 L 106 82 L 96 82 L 96 74 L 88 74 L 88 84 L 78 84 L 78 74 L 58 74 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M40 92 C 10 72, 6 50, 16 38 C 26 26, 38 30, 40 42 C 42 30, 54 26, 64 38 C 74 50, 70 72, 40 92 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M40 70 C 30 62, 28 54, 32 50 C 35 47, 39 49, 40 52 C 41 49, 45 47, 48 50 C 52 54, 50 62, 40 70 Z" fill="#FF8DB8" stroke="${O}" stroke-width="3"/>` +
      shine(24, 46, 6, 3, -40));
  },

  gift() {
    const box = grad('#C9F2DD', '#68CFA0');
    const rib = grad('#FFC2DA', '#F2669A');
    return svg([box.def, rib.def],
      `<rect x="22" y="56" width="84" height="58" rx="8" fill="${box.fill}" ${stroke}/>` +
      `<rect x="14" y="40" width="100" height="22" rx="7" fill="${box.fill}" ${stroke}/>` +
      `<rect x="56" y="40" width="16" height="74" fill="${rib.fill}" ${stroke}/>` +
      `<path d="M62 40 C 44 18, 22 22, 30 36 C 34 42, 48 42, 62 40 Z" fill="${rib.fill}" ${stroke}/>` +
      `<path d="M66 40 C 84 18, 106 22, 98 36 C 94 42, 80 42, 66 40 Z" fill="${rib.fill}" ${stroke}/>` +
      shine(34, 74, 4, 10, 0));
  },

  tag() {
    const g = grad('#FFC9DD', '#F27AA8');
    return svg([g.def],
      `<path d="M64 12 L 112 12 C 114 12, 116 14, 116 16 L 116 64 L 62 118 L 10 66 Z" fill="${g.fill}" ${stroke}/>` +
      `<circle cx="96" cy="32" r="8" fill="#fff" ${stroke}/>` +
      `<circle cx="52" cy="62" r="7" fill="none" stroke="#fff" stroke-width="5"/>` +
      `<circle cx="72" cy="82" r="7" fill="none" stroke="#fff" stroke-width="5"/>` +
      `<path d="M76 56 L 48 88" stroke="#fff" stroke-width="5"/>`);
  },

  search() {
    const glass = grad('#E8F6FF', '#9FD8FF');
    const handle = grad('#FFB3CF', '#F2669A');
    return svg([glass.def, handle.def],
      `<path d="M78 78 L 112 112" stroke="${O}" stroke-width="22"/><path d="M78 78 L 112 112" stroke="${handle.fill}" stroke-width="12"/>` +
      `<circle cx="52" cy="52" r="36" fill="${glass.fill}" ${stroke} stroke-width="7"/>` +
      `<path d="M34 46 C 36 36, 44 30, 54 30" fill="none" stroke="#fff" stroke-width="6" opacity="0.9"/>` +
      `<path d="M66 54 C 67 60, 70 63, 76 64 C 70 65, 67 68, 66 74 C 65 68, 62 65, 56 64 C 62 63, 65 60, 66 54 Z" fill="#FFD45C" stroke="${O}" stroke-width="2.5"/>`);
  },

  tv() {
    const g = grad('#EADFFF', '#B394F7');
    const screen = grad('#FFE3EE', '#FFB3CF');
    return svg([g.def, screen.def],
      `<path d="M50 30 L 38 12 M78 30 L 90 12" ${stroke}/>` + dot(38, 12, 5, '#FF8DB8') + dot(90, 12, 5, '#FF8DB8') +
      `<path d="M22 40 L 30 22 L 44 34 Z M106 40 L 98 22 L 84 34 Z" fill="${g.fill}" ${stroke}/>` +
      `<rect x="12" y="32" width="104" height="80" rx="20" fill="${g.fill}" ${stroke}/>` +
      `<rect x="24" y="44" width="80" height="56" rx="12" fill="${screen.fill}" ${stroke}/>` +
      `<path d="M50 70 Q 54 64, 58 70 M70 70 Q 74 64, 78 70" fill="none" stroke="${O}" stroke-width="4"/>` +
      `<path d="M58 80 Q 61 84, 64 80 Q 67 84, 70 80" fill="none" stroke="${O}" stroke-width="3.5"/>` +
      dot(44, 80, 5, '#FF7AA8', 0.6) + dot(84, 80, 5, '#FF7AA8', 0.6) + shine(36, 54, 5, 3, -30));
  },

  book() {
    const l = grad('#FFFFFF', '#F3E6FF');
    const c = grad('#FFB3CF', '#F2669A');
    return svg([l.def, c.def],
      `<path d="M8 32 L 8 106 L 58 106 C 60 110, 68 110, 70 106 L 120 106 L 120 32 Z" fill="${c.fill}" ${stroke}/>` +
      `<path d="M16 24 C 34 20, 52 24, 64 34 L 64 100 C 52 90, 34 88, 16 92 Z" fill="${l.fill}" ${stroke}/>` +
      `<path d="M112 24 C 94 20, 76 24, 64 34 L 64 100 C 76 90, 94 88, 112 92 Z" fill="${l.fill}" ${stroke}/>` +
      `<path d="M26 44 C 36 42, 46 44, 54 48 M26 58 C 36 56, 46 58, 54 62 M26 72 C 36 70, 46 72, 54 76" fill="none" stroke="#C9B3F5" stroke-width="4"/>` +
      `<path d="M88 52 C 80 46, 80 40, 84 38 C 86 37, 88 38, 88 40 C 88 38, 90 37, 92 38 C 96 40, 96 46, 88 52 Z" fill="#FF8DB8" stroke="${O}" stroke-width="2.5"/>`);
  },

  cat() {
    const g = grad('#FFFFFF', '#FFE9D6');
    return svg([g.def],
      `<path d="M22 56 L 26 14 L 56 36 Z M106 56 L 102 14 L 72 36 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M30 46 L 31 26 L 46 37 Z M98 46 L 97 26 L 82 37 Z" fill="#FFB3CF"/>` +
      `<ellipse cx="64" cy="72" rx="50" ry="42" fill="${g.fill}" ${stroke}/>` +
      `<ellipse cx="46" cy="70" rx="5" ry="7" fill="${O}"/><ellipse cx="82" cy="70" rx="5" ry="7" fill="${O}"/>` +
      dot(48, 67, 2) + dot(84, 67, 2) +
      `<path d="M56 84 Q 60 90, 64 84 Q 68 90, 72 84" fill="none" stroke="${O}" stroke-width="3.5"/>` +
      dot(34, 84, 7, '#FF8DB8', 0.55) + dot(94, 84, 7, '#FF8DB8', 0.55) +
      `<path d="M8 72 L 26 76 M8 84 L 26 82 M120 72 L 102 76 M120 84 L 102 82" stroke="${O}" stroke-width="3"/>`);
  },

  paw() {
    const g = grad('#FFC9DD', '#F27AA8');
    const toe = (cx, cy, rx, ry, rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${g.fill}" ${stroke} transform="rotate(${rot} ${cx} ${cy})"/>`;
    return svg([g.def],
      `<path d="M64 62 C 88 62, 104 82, 100 98 C 96 112, 80 110, 64 104 C 48 110, 32 112, 28 98 C 24 82, 40 62, 64 62 Z" fill="${g.fill}" ${stroke}/>` +
      toe(26, 50, 11, 14, -20) + toe(50, 28, 11, 15, -8) + toe(78, 28, 11, 15, 8) + toe(102, 50, 11, 14, 20) +
      shine(52, 76, 8, 4, -20));
  },

  check() {
    return circleBadge('#B9F3D4', '#41C08A', `<path d="M38 66 L 56 84 L 92 46" fill="none" stroke="${O}" stroke-width="16"/><path d="M38 66 L 56 84 L 92 46" fill="none" stroke="#fff" stroke-width="8"/>`);
  },

  cross() {
    return circleBadge('#FFC1C8', '#F0637A', `<path d="M44 44 L 84 84 M84 44 L 44 84" stroke="${O}" stroke-width="16"/><path d="M44 44 L 84 84 M84 44 L 44 84" stroke="#fff" stroke-width="8"/>`);
  },

  warn() {
    const g = grad('#FFF0A0', '#FFC23D');
    return svg([g.def],
      `<path d="M64 12 C 68 12, 70 14, 72 18 L 118 100 C 121 106, 118 114, 110 114 L 18 114 C 10 114, 7 106, 10 100 L 56 18 C 58 14, 60 12, 64 12 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M64 44 L 64 76" stroke="${O}" stroke-width="12"/>` + dot(64, 94, 7, O) + shine(50, 40, 3, 8, 30));
  },

  info() {
    return circleBadge('#E6DAFF', '#9F7BF2', `<path d="M64 58 L 64 92" stroke="${O}" stroke-width="16"/><path d="M64 58 L 64 92" stroke="#fff" stroke-width="8"/>` + `<circle cx="64" cy="38" r="9" fill="#fff" stroke="${O}" stroke-width="4"/>`);
  },

  help() {
    const g = grad('#E6DAFF', '#9F7BF2');
    return svg([g.def],
      `<path d="M64 12 C 96 12, 118 32, 118 58 C 118 84, 96 102, 64 102 C 58 102, 52 101, 46 99 L 22 114 L 28 90 C 16 80, 10 70, 10 58 C 10 32, 32 12, 64 12 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M50 46 C 50 30, 78 30, 78 46 C 78 58, 64 58, 64 70" fill="none" stroke="${O}" stroke-width="14"/>` +
      `<path d="M50 46 C 50 30, 78 30, 78 46 C 78 58, 64 58, 64 70" fill="none" stroke="#fff" stroke-width="7"/>` +
      `<circle cx="64" cy="86" r="7" fill="#fff" stroke="${O}" stroke-width="4"/>`);
  },

  arrow_left() {
    return circleBadge('#FFC9DD', '#F27AA8', `<path d="M74 38 L 48 64 L 74 90" fill="none" stroke="${O}" stroke-width="17"/><path d="M74 38 L 48 64 L 74 90" fill="none" stroke="#fff" stroke-width="9"/>`);
  },

  arrow_right() {
    return circleBadge('#FFC9DD', '#F27AA8', `<path d="M54 38 L 80 64 L 54 90" fill="none" stroke="${O}" stroke-width="17"/><path d="M54 38 L 80 64 L 54 90" fill="none" stroke="#fff" stroke-width="9"/>`);
  },

  clock() {
    const g = grad('#FFD1E1', '#F78DB4');
    return svg([g.def],
      `<path d="M22 32 C 16 22, 26 10, 38 16 Z M106 32 C 112 22, 102 10, 90 16 Z" fill="#FFD45C" ${stroke}/>` +
      `<path d="M36 104 L 28 116 M92 104 L 100 116" ${stroke}/>` +
      `<circle cx="64" cy="66" r="46" fill="${g.fill}" ${stroke}/>` +
      `<circle cx="64" cy="66" r="34" fill="#fff" stroke="${O}" stroke-width="3.5"/>` +
      `<path d="M64 66 L 64 44 M64 66 L 80 74" stroke="${O}" stroke-width="5"/>` + dot(64, 66, 4.5, '#F2669A'));
  },

  crown() {
    const g = grad('#FFF0A0', '#F5B53B');
    return svg([g.def],
      `<path d="M14 40 L 36 70 L 64 26 L 92 70 L 114 40 L 104 102 L 24 102 Z" fill="${g.fill}" ${stroke}/>` +
      `<rect x="22" y="96" width="84" height="16" rx="6" fill="${g.fill}" ${stroke}/>` +
      dot(14, 40, 8, '#FF8DB8') + `<circle cx="14" cy="40" r="8" fill="none" stroke="${O}" stroke-width="4"/>` +
      dot(64, 22, 8, '#B394F7') + `<circle cx="64" cy="22" r="8" fill="none" stroke="${O}" stroke-width="4"/>` +
      dot(114, 40, 8, '#7FD8B0') + `<circle cx="114" cy="40" r="8" fill="none" stroke="${O}" stroke-width="4"/>` +
      `<path d="M64 88 C 54 82, 52 74, 56 70 C 59 67, 63 68, 64 72 C 65 68, 69 67, 72 70 C 76 74, 74 82, 64 88 Z" fill="#FF8DB8" stroke="${O}" stroke-width="3"/>`);
  },

  cards() {
    const back = grad('#EADFFF', '#B394F7');
    const front = grad('#FFFFFF', '#FFE9F1');
    return svg([back.def, front.def],
      `<rect x="16" y="22" width="56" height="80" rx="9" fill="${back.fill}" ${stroke} transform="rotate(-14 44 62)"/>` +
      `<rect x="52" y="22" width="56" height="80" rx="9" fill="${front.fill}" ${stroke} transform="rotate(10 80 62)"/>` +
      `<path transform="rotate(10 80 62)" d="M80 82 C 64 72, 62 60, 68 54 C 73 50, 78 52, 80 57 C 82 52, 87 50, 92 54 C 98 60, 96 72, 80 82 Z" fill="#F2558F" stroke="${O}" stroke-width="3"/>`);
  },

  shield() {
    const g = grad('#E6DAFF', '#9F7BF2');
    return svg([g.def],
      `<path d="M64 10 C 80 20, 96 24, 112 24 C 112 72, 96 100, 64 118 C 32 100, 16 72, 16 24 C 32 24, 48 20, 64 10 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M64 90 C 42 76, 38 60, 46 52 C 52 46, 60 48, 64 56 C 68 48, 76 46, 82 52 C 90 60, 86 76, 64 90 Z" fill="#fff" stroke="${O}" stroke-width="4"/>` +
      shine(40, 36, 8, 4, -20));
  },

  gear() {
    const g = grad('#E6DAFF', '#9F7BF2');
    let teeth = '';
    for (let i = 0; i < 8; i++) {
      teeth += `<rect x="54" y="6" width="20" height="26" rx="6" fill="${g.fill}" ${stroke} transform="rotate(${45 * i} 64 64)"/>`;
    }
    return svg([g.def],
      teeth + `<circle cx="64" cy="64" r="40" fill="${g.fill}" ${stroke}/>` +
      `<circle cx="64" cy="64" r="16" fill="#fff" ${stroke}/>` + shine(46, 44, 8, 4, -40));
  },

  palette() {
    const g = grad('#FFF6E8', '#F5D9B8');
    return svg([g.def],
      `<path d="M64 12 C 100 12, 120 36, 118 62 C 116 84, 100 82, 90 80 C 80 78, 76 86, 80 96 C 84 108, 76 116, 62 116 C 30 116, 10 92, 10 64 C 10 34, 34 12, 64 12 Z" fill="${g.fill}" ${stroke}/>` +
      `<circle cx="40" cy="48" r="10" fill="#FF8DB8" stroke="${O}" stroke-width="3.5"/>` +
      `<circle cx="66" cy="34" r="10" fill="#B394F7" stroke="${O}" stroke-width="3.5"/>` +
      `<circle cx="92" cy="48" r="10" fill="#7FD8B0" stroke="${O}" stroke-width="3.5"/>` +
      `<circle cx="36" cy="78" r="10" fill="#FFD45C" stroke="${O}" stroke-width="3.5"/>` +
      `<circle cx="60" cy="96" r="9" fill="#fff" stroke="${O}" stroke-width="3.5"/>`);
  },

  strawberry() {
    const g = grad('#FF9DB5', '#E8395F');
    return svg([g.def],
      `<path d="M64 118 C 30 100, 14 70, 22 50 C 30 32, 50 36, 64 40 C 78 36, 98 32, 106 50 C 114 70, 98 100, 64 118 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M64 42 L 44 30 L 52 22 L 64 30 L 76 22 L 84 30 Z" fill="#6BCB8B" ${stroke}/>` +
      `<path d="M64 30 L 64 12" ${stroke}/>` +
      [[44, 60], [64, 58], [84, 60], [52, 78], [76, 78], [64, 96], [38, 76], [90, 76]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="4" fill="#FFE08A"/>`).join('') +
      shine(38, 56, 6, 10, 20));
  },

  moon() {
    const g = grad('#FFF0A0', '#FFC23D');
    return svg([g.def],
      `<path d="M78 14 C 52 18, 34 42, 36 70 C 38 98, 62 118, 90 114 C 64 106, 50 82, 54 58 C 58 36, 70 22, 78 14 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M54 76 Q 58 80, 62 76" fill="none" stroke="${O}" stroke-width="3.5"/>` + dot(50, 86, 4, '#FF8DB8', 0.6) +
      `<path d="M90 26 L 110 26 L 90 48 L 110 48" fill="none" stroke="${O}" stroke-width="11"/>` +
      `<path d="M90 26 L 110 26 L 90 48 L 110 48" fill="none" stroke="#E6DAFF" stroke-width="5"/>` +
      `<path d="M98 64 L 112 64 L 98 80 L 112 80" fill="none" stroke="${O}" stroke-width="9"/>` +
      `<path d="M98 64 L 112 64 L 98 80 L 112 80" fill="none" stroke="#E6DAFF" stroke-width="4"/>`);
  },

  gamepad() {
    const g = grad('#EADFFF', '#B394F7');
    return svg([g.def],
      `<path d="M34 34 L 94 34 C 112 34, 120 54, 122 78 C 124 100, 110 110, 98 98 L 86 84 L 42 84 L 30 98 C 18 110, 4 100, 6 78 C 8 54, 16 34, 34 34 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M36 50 L 36 70 M26 60 L 46 60" stroke="${O}" stroke-width="7"/>` +
      `<circle cx="88" cy="52" r="6" fill="#FF8DB8" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="100" cy="64" r="6" fill="#7FD8B0" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="76" cy="64" r="6" fill="#FFD45C" stroke="${O}" stroke-width="3"/>` +
      shine(30, 44, 8, 3, -20));
  },

  wand() {
    const g = grad('#FFF0A0', '#FFBE3D');
    return svg([g.def],
      `<path d="M28 108 L 70 58" stroke="${O}" stroke-width="15"/><path d="M28 108 L 70 58" stroke="#FFB3CF" stroke-width="7"/>` +
      `<path d="M82 14 L 90 34 L 112 36 L 96 50 L 100 72 L 82 60 L 64 72 L 68 50 L 52 36 L 74 34 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M26 40 C 27 46, 30 49, 36 50 C 30 51, 27 54, 26 60 C 25 54, 22 51, 16 50 C 22 49, 25 46, 26 40 Z" fill="#FF8DB8" stroke="${O}" stroke-width="3"/>` +
      `<path d="M108 86 C 109 91, 111 93, 116 94 C 111 95, 109 97, 108 102 C 107 97, 105 95, 100 94 C 105 93, 107 91, 108 86 Z" fill="#B394F7" stroke="${O}" stroke-width="3"/>`);
  },

  fire() {
    const g = grad('#FFD45C', '#FF6E8E');
    const inner = grad('#FFF6C2', '#FFC94D');
    return svg([g.def, inner.def],
      `<path d="M64 118 C 34 118, 18 98, 20 74 C 22 52, 40 40, 44 18 C 58 30, 62 44, 60 56 C 68 48, 72 38, 72 28 C 92 44, 110 62, 108 84 C 106 104, 90 118, 64 118 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M64 110 C 48 110, 42 98, 44 88 C 46 78, 56 72, 58 62 C 66 70, 70 78, 68 86 C 74 82, 78 76, 78 70 C 86 80, 90 90, 86 98 C 82 106, 74 110, 64 110 Z" fill="${inner.fill}" stroke="${O}" stroke-width="3.5"/>`);
  },

  bell() {
    const g = grad('#FFF0A0', '#F5B53B');
    return svg([g.def],
      `<path d="M64 10 L 64 22" ${stroke}/>` +
      `<path d="M64 20 C 40 20, 30 40, 30 62 L 30 80 L 16 96 L 112 96 L 98 80 L 98 62 C 98 40, 88 20, 64 20 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M50 100 C 50 118, 78 118, 78 100" fill="#FF8DB8" ${stroke}/>` +
      `<path d="M8 50 C 8 36, 13 26, 20 19 M120 50 C 120 36, 115 26, 108 19" fill="none" stroke="${O}" stroke-width="10"/>` +
      `<path d="M8 50 C 8 36, 13 26, 20 19 M120 50 C 120 36, 115 26, 108 19" fill="none" stroke="#FFB3CF" stroke-width="4"/>` +
      shine(46, 46, 5, 12, 10));
  },

  calendar() {
    const g = grad('#FFFFFF', '#FFE9F1');
    const top = grad('#FFB3CF', '#F2669A');
    return svg([g.def, top.def],
      `<rect x="14" y="24" width="100" height="92" rx="14" fill="${g.fill}" ${stroke}/>` +
      `<path d="M14 54 L 14 38 C 14 30, 20 24, 28 24 L 100 24 C 108 24, 114 30, 114 38 L 114 54 Z" fill="${top.fill}" ${stroke}/>` +
      `<path d="M40 14 L 40 34 M88 14 L 88 34" ${stroke} stroke-width="7"/>` +
      [[38, 74], [64, 74], [90, 74], [38, 98], [64, 98]].map(([x, y]) => `<rect x="${x - 8}" y="${y - 7}" width="16" height="14" rx="4" fill="#E6DAFF"/>`).join('') +
      `<path d="M90 104 C 80 98, 78 92, 82 88 C 85 85, 89 86, 90 89 C 91 86, 95 85, 98 88 C 102 92, 100 98, 90 104 Z" fill="#F2558F" stroke="${O}" stroke-width="2.5"/>`);
  },

  chat() {
    const g = grad('#FFFFFF', '#FFE3EE');
    return svg([g.def],
      `<path d="M24 18 L 104 18 C 112 18, 118 24, 118 32 L 118 76 C 118 84, 112 90, 104 90 L 56 90 L 30 112 L 34 90 L 24 90 C 16 90, 10 84, 10 76 L 10 32 C 10 24, 16 18, 24 18 Z" fill="${g.fill}" ${stroke}/>` +
      dot(40, 54, 7, '#FF8DB8') + dot(64, 54, 7, '#B394F7') + dot(88, 54, 7, '#7FD8B0'));
  },

  link() {
    const g = grad('#E6DAFF', '#9F7BF2');
    return svg([g.def],
      `<path d="M56 72 L 72 56" stroke="${O}" stroke-width="15"/><path d="M56 72 L 72 56" stroke="#fff" stroke-width="7"/>` +
      `<rect x="10" y="58" width="52" height="34" rx="17" fill="none" stroke="${O}" stroke-width="16" transform="rotate(-45 36 75)"/>` +
      `<rect x="10" y="58" width="52" height="34" rx="17" fill="none" stroke="${g.fill}" stroke-width="8" transform="rotate(-45 36 75)"/>` +
      `<rect x="66" y="36" width="52" height="34" rx="17" fill="none" stroke="${O}" stroke-width="16" transform="rotate(-45 92 53)"/>` +
      `<rect x="66" y="36" width="52" height="34" rx="17" fill="none" stroke="#FF8DB8" stroke-width="8" transform="rotate(-45 92 53)"/>`);
  },

  shuffle() {
    return circleBadge('#C9F2DD', '#4FC594',
      `<path d="M36 50 L 54 50 C 66 50, 70 78, 82 78 L 92 78 M36 78 L 54 78 C 66 78, 70 50, 82 50 L 92 50" fill="none" stroke="${O}" stroke-width="13"/>` +
      `<path d="M36 50 L 54 50 C 66 50, 70 78, 82 78 L 92 78 M36 78 L 54 78 C 66 78, 70 50, 82 50 L 92 50" fill="none" stroke="#fff" stroke-width="6"/>` +
      `<path d="M88 40 L 100 50 L 88 60 Z M88 68 L 100 78 L 88 88 Z" fill="#fff" stroke="${O}" stroke-width="3.5"/>`);
  },

  trophy() {
    const g = grad('#FFF0A0', '#F5B53B');
    return svg([g.def],
      `<path d="M32 26 C 8 26, 10 58, 34 60 M96 26 C 120 26, 118 58, 94 60" fill="none" ${stroke} stroke-width="7"/>` +
      `<path d="M30 16 L 98 16 L 96 48 C 94 72, 80 82, 64 82 C 48 82, 34 72, 32 48 Z" fill="${g.fill}" ${stroke}/>` +
      `<rect x="56" y="80" width="16" height="16" fill="${g.fill}" ${stroke}/>` +
      `<rect x="34" y="96" width="60" height="20" rx="6" fill="#B394F7" ${stroke}/>` +
      `<path d="M64 62 L 69 51 L 81 50 L 72 42 L 75 30 L 64 37 L 53 30 L 56 42 L 47 50 L 59 51 Z" fill="#fff" stroke="${O}" stroke-width="2.5"/>`);
  },

  coffee() {
    const g = grad('#FFFFFF', '#FFE3EE');
    return svg([g.def],
      `<path d="M44 14 C 38 22, 50 26, 44 34 M64 10 C 58 18, 70 22, 64 30 M84 14 C 78 22, 90 26, 84 34" fill="none" stroke="#C9B3F5" stroke-width="5"/>` +
      `<path d="M96 56 C 120 56, 120 90, 96 88" fill="none" ${stroke} stroke-width="8"/>` +
      `<path d="M18 44 L 102 44 L 96 98 C 94 110, 84 116, 72 116 L 48 116 C 36 116, 26 110, 24 98 Z" fill="${g.fill}" ${stroke}/>` +
      `<path d="M60 92 C 46 82, 44 72, 50 66 C 55 62, 59 64, 60 68 C 61 64, 65 62, 70 66 C 76 72, 74 82, 60 92 Z" fill="#FF8DB8" stroke="${O}" stroke-width="3"/>`);
  },

  slot() {
    const g = grad('#FFC9DD', '#F27AA8');
    return svg([g.def],
      `<rect x="10" y="20" width="94" height="96" rx="16" fill="${g.fill}" ${stroke}/>` +
      `<rect x="20" y="44" width="74" height="40" rx="8" fill="#fff" ${stroke} stroke-width="4"/>` +
      `<path d="M44 44 L 44 84 M70 44 L 70 84" stroke="${O}" stroke-width="3.5"/>` +
      `<text x="32" y="74" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="22" text-anchor="middle" fill="#F2558F">7</text>` +
      `<text x="57" y="74" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="22" text-anchor="middle" fill="#9F7BF2">7</text>` +
      `<text x="82" y="74" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="22" text-anchor="middle" fill="#41C08A">7</text>` +
      `<path d="M104 40 L 116 40 L 116 70" fill="none" ${stroke}/>` + dot(116, 30, 8, '#FFD45C') + `<circle cx="116" cy="30" r="8" fill="none" stroke="${O}" stroke-width="4"/>` +
      `<rect x="30" y="94" width="54" height="10" rx="5" fill="${O}" opacity="0.5"/>`);
  },
};

module.exports = { designs };

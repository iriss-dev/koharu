'use strict';

/**
 * Fashion helper: outfit generator, style guides, colour harmonies, seasonal
 * colour analysis, tips, and "find this piece" shopping searches.
 */

const ui = require('../../core/ui');
const router = require('../../core/router');
const { register, t, pick } = require('../../core/i18n');
const db = require('../../database/db');
const colors = require('../../utils/colors');
const png = require('../../utils/png');
const { rng, randomSeed, pickOne } = require('../../utils/text');
const data = require('./data');

register('fashion', {
  es: {
    outfitTitle: 'Outfit para: {occasion}',
    outfitSubtitle: 'Estilo {style} · Clima: {weather}',
    top: 'Arriba',
    bottom: 'Abajo',
    dress: 'Prenda principal',
    outer: 'Encima',
    shoes: 'Zapatos',
    accessories: 'Accesorios',
    bag: 'Bolso',
    palette: 'Paleta',
    muse: 'Inspiración anime',
    adjusted: 'Ajusté el estilo un poquito para que tenga sentido con la ocasión y el clima.',
    another: 'Otro outfit',
    findPlaceholder: 'Buscar una prenda en tiendas…',
    styleGuide: 'Guía {style}',
    findTitle: 'Buscar: {piece}',
    findBody: 'Te dejo búsquedas listas en varias tiendas e inspiración en Pinterest.',
    findFooter: 'Koharu no gana nada con estos enlaces: son búsquedas normales.',
    keyPieces: 'Prendas clave',
    shoesLabel: 'Calzado',
    tipLabel: 'Consejo',
    avoidLabel: 'Evita',
    muses: 'Personajes con este estilo',
    useInProfile: 'Usar en mi perfil',
    outfitWithStyle: 'Outfit con este estilo',
    profileSet: '{e:ribbon} Tu estilo ahora es **{style}**. Se ve en tu `/perfil`.',
    colorsTitle: 'Combinaciones para {name}',
    colorsSubtitle: '{hex} · tono {temp}',
    temps: { warm: 'cálido', cool: 'frío', neutral: 'neutro' },
    harmony: {
      monochrome: 'Monocromático',
      analogous: 'Análogos',
      complementary: 'Complementario',
      triadic: 'Tríada',
      split: 'Complementario dividido',
    },
    harmonyHint: {
      monochrome: 'elegante y alarga la figura',
      analogous: 'suave y armonioso, ideal para el día',
      complementary: 'contraste con mucha personalidad: usa uno como acento',
      triadic: 'divertido y equilibrado, perfecto para looks kawaii',
      split: 'contraste más suave que el complementario',
    },
    neutralsTitle: 'Neutros que siempre le quedan',
    rowsNote: 'Filas de la imagen, de arriba abajo: monocromático, análogos, complementario y tríada.',
    badColor: 'No reconocí «{input}». Usa un código como `#F472B6` o un nombre como `lavanda`, `verde salvia` o `burdeos`.',
    seasonTitle: 'Tu colorimetría: {season}',
    seasonAlt: 'También podrías ser **{season}**: prueba ambas paletas frente a un espejo con luz natural.',
    bestColors: 'Tus colores',
    neutrals: 'Neutros',
    metal: 'Metal',
    avoidColors: 'Con cuidado',
    undertoneHelp: '¿No sabes tu subtono? Mira las venas de tu muñeca con luz natural: verdosas → cálido, azuladas o moradas → frío, una mezcla → neutro.',
    tipTitle: 'Tip de moda · {topic}',
    anotherTip: 'Otro tip',
  },
  en: {
    outfitTitle: 'Outfit for: {occasion}',
    outfitSubtitle: '{style} style · Weather: {weather}',
    top: 'Top',
    bottom: 'Bottom',
    dress: 'Main piece',
    outer: 'Layer',
    shoes: 'Shoes',
    accessories: 'Accessories',
    bag: 'Bag',
    palette: 'Palette',
    muse: 'Anime inspiration',
    adjusted: 'I nudged the style a little so it makes sense for the occasion and weather.',
    another: 'Another outfit',
    findPlaceholder: 'Find a piece in shops…',
    styleGuide: '{style} guide',
    findTitle: 'Find: {piece}',
    findBody: 'Here are ready-made searches in several shops, plus inspiration on Pinterest.',
    findFooter: 'Koharu earns nothing from these links: they are plain searches.',
    keyPieces: 'Key pieces',
    shoesLabel: 'Shoes',
    tipLabel: 'Tip',
    avoidLabel: 'Avoid',
    muses: 'Characters with this style',
    useInProfile: 'Use on my profile',
    outfitWithStyle: 'Outfit in this style',
    profileSet: '{e:ribbon} Your style is now **{style}**. It shows on your `/profile`.',
    colorsTitle: 'Combinations for {name}',
    colorsSubtitle: '{hex} · {temp} tone',
    temps: { warm: 'warm', cool: 'cool', neutral: 'neutral' },
    harmony: {
      monochrome: 'Monochrome',
      analogous: 'Analogous',
      complementary: 'Complementary',
      triadic: 'Triadic',
      split: 'Split complementary',
    },
    harmonyHint: {
      monochrome: 'elegant and lengthening',
      analogous: 'soft and harmonious, great for daytime',
      complementary: 'bold contrast: use one as an accent',
      triadic: 'playful and balanced, perfect for kawaii looks',
      split: 'softer contrast than complementary',
    },
    neutralsTitle: 'Neutrals that always work',
    rowsNote: 'Image rows, top to bottom: monochrome, analogous, complementary and triadic.',
    badColor: 'I did not recognise “{input}”. Use a code like `#F472B6` or a name like `lavender`, `sage green` or `burgundy`.',
    seasonTitle: 'Your colour season: {season}',
    seasonAlt: 'You might also be **{season}**: try both palettes in front of a mirror in daylight.',
    bestColors: 'Your colours',
    neutrals: 'Neutrals',
    metal: 'Metal',
    avoidColors: 'Use with care',
    undertoneHelp: 'Not sure about your undertone? Look at the veins on your wrist in daylight: greenish → warm, blue or purple → cool, a mix → neutral.',
    tipTitle: 'Fashion tip · {topic}',
    anotherTip: 'Another tip',
  },
});

const L = (locale, key, vars) => t(locale, `fashion.${key}`, vars);

// --------------------------------------------------------------------------- outfit generator

const matches = (tagSet, value) => !tagSet || tagSet.has(value);
const HEAD = new Set(['a1', 'a5', 'a8', 'a9', 'a10', 'a19', 'a21']);

function candidates(slot, style, occasion, weather) {
  const strict = p => p.slot === slot && matches(p.styles, style) && matches(p.occasions, occasion) && matches(p.weather, weather);
  const levels = [
    strict,
    p => p.slot === slot && matches(p.occasions, occasion) && matches(p.weather, weather),
    p => p.slot === slot && matches(p.styles, style) && matches(p.occasions, occasion),
    p => p.slot === slot && matches(p.occasions, occasion),
    p => p.slot === slot && matches(p.weather, weather),
    p => p.slot === slot,
  ];
  for (let level = 0; level < levels.length; level++) {
    const list = data.WARDROBE.filter(levels[level]);
    if (list.length) return { list, level };
  }
  return { list: [], level: 99 };
}

const strictCount = (slot, style, occasion, weather) => candidates(slot, style, occasion, weather).level === 0
  ? candidates(slot, style, occasion, weather).list.length : 0;

/** Styles that have a complete outfit without relaxing any filter. */
function stylesFor(occasion, weather) {
  return Object.keys(data.STYLES).filter(style => {
    const body = strictCount('dress', style, occasion, weather) > 0
      || (strictCount('top', style, occasion, weather) > 0 && strictCount('bottom', style, occasion, weather) > 0);
    return body && strictCount('shoes', style, occasion, weather) > 0;
  });
}

/**
 * @param {{ occasion: string, weather: string, style?: string|null, seed?: number }} options
 */
function generateOutfit({ occasion, weather, style = null, seed = randomSeed() }) {
  const random = rng(seed);
  const fitting = stylesFor(occasion, weather);
  const chosen = style || pickOne(fitting.length ? fitting : Object.keys(data.STYLES), random);
  let relaxed = false;

  // Only the pieces that define the look count as "adjusted"; accessories may borrow freely.
  const take = (slot, core = true) => {
    const { list, level } = candidates(slot, chosen, occasion, weather);
    if (core && level > 0) relaxed = true;
    return pickOne(list, random);
  };

  const dressOptions = candidates('dress', chosen, occasion, weather);
  const topOptions = candidates('top', chosen, occasion, weather);
  const bottomOptions = candidates('bottom', chosen, occasion, weather);
  const separatesStrict = topOptions.level === 0 && bottomOptions.level === 0;
  const dressStrict = dressOptions.level === 0;
  const dressBias = { wedding: 0.75, party: 0.5, date: 0.45, beach: 0.4, sport: 0.15 }[occasion] ?? 0.3;
  const useDress = dressStrict && (!separatesStrict || random() < dressBias);

  const pieces = {};
  if (useDress) pieces.dress = take('dress');
  else {
    pieces.top = take('top');
    pieces.bottom = take('bottom');
  }

  const needsLayer = weather === 'cold' || weather === 'rain' || (weather === 'mild' && occasion !== 'beach' && random() < 0.5);
  if (needsLayer && occasion !== 'beach') pieces.outer = take('outer', false);
  pieces.shoes = take('shoes');

  // Two accessories, never two for the head (a beret and a bow fight each other).
  const accessoryPool = candidates('accessory', chosen, occasion, weather).list;
  const first = pickOne(accessoryPool, random);
  const rest = accessoryPool.filter(item => item.id !== first.id && !(HEAD.has(item.id) && HEAD.has(first.id)));
  pieces.accessories = rest.length ? [first, pickOne(rest, random)] : [first];
  pieces.bag = take('bag', false);

  const palette = [...data.STYLES[chosen].palette].sort(() => random() - 0.5).slice(0, 4);
  return { occasion, weather, style: chosen, requestedStyle: style, pieces, palette, relaxed, seed };
}

// --------------------------------------------------------------------------- shopping searches

function shopLinks(query) {
  const q = encodeURIComponent(query);
  return [
    { label: 'Pinterest', url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(`${query} outfit`)}`, emoji: 'sparkle' },
    { label: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${q}`, emoji: 'search' },
    { label: 'Amazon', url: `https://www.amazon.com/s?k=${q}`, emoji: 'bag' },
    { label: 'SHEIN', url: `https://www.shein.com/pdsearch/${q}/`, emoji: 'tag' },
  ];
}

const allPieces = outfit => [outfit.pieces.dress, outfit.pieces.top, outfit.pieces.bottom, outfit.pieces.outer, outfit.pieces.shoes, ...(outfit.pieces.accessories ?? []), outfit.pieces.bag].filter(Boolean);

// --------------------------------------------------------------------------- cards

const paletteNames = (locale, hexes) => hexes.map(hex => colors.nearestName(hex, locale).name).join(' · ');

function paletteImage(hexes, name = 'palette.png') {
  return ui.bufferAttachment(png.swatchRows([hexes], { rowHeight: 84, width: 640 }), name);
}

function outfitMessage(locale, outfit, owner) {
  const style = data.STYLES[outfit.style];
  const occasion = data.OCCASIONS[outfit.occasion];
  const weather = data.WEATHER[outfit.weather];
  const { pieces } = outfit;
  const name = piece => piece[locale];

  const lines = [];
  if (pieces.dress) lines.push(ui.bullet('dress', L(locale, 'dress'), name(pieces.dress)));
  if (pieces.top) lines.push(ui.bullet('ribbon', L(locale, 'top'), name(pieces.top)));
  if (pieces.bottom) lines.push(ui.bullet('dress', L(locale, 'bottom'), name(pieces.bottom)));
  if (pieces.outer) lines.push(ui.bullet('moon', L(locale, 'outer'), name(pieces.outer)));
  lines.push(ui.bullet('star', L(locale, 'shoes'), name(pieces.shoes)));
  lines.push(ui.bullet('sparkle', L(locale, 'accessories'), pieces.accessories.map(name).join(' + ')));
  lines.push(ui.bullet('bag', L(locale, 'bag'), name(pieces.bag)));

  const image = paletteImage(outfit.palette);
  const tips = [pick(locale, data.OCCASION_TIPS[outfit.occasion]), pick(locale, data.WEATHER_TIPS[outfit.weather])];
  const muse = pickOne(style.muses, rng(outfit.seed + 7));

  const card = ui.card({
    accent: outfit.palette[0],
    emoji: style.emoji,
    title: L(locale, 'outfitTitle', { occasion: pick(locale, occasion) }),
    subtitle: L(locale, 'outfitSubtitle', { style: pick(locale, style.name), weather: pick(locale, weather) }),
    body: [
      'sep',
      lines.join('\n'),
      'sep',
      `${ui.bullet('palette', L(locale, 'palette'), paletteNames(locale, outfit.palette))}`,
      ui.gallery({ url: image.url, description: paletteNames(locale, outfit.palette) }),
      ui.quote(tips.join('\n')),
      ui.sub(`${L(locale, 'muse')}: ${muse}${outfit.relaxed ? ` · ${L(locale, 'adjusted')}` : ''}`),
      ui.row(ui.select({
        id: router.encode('fashion', 'find', '*', outfit.style),
        placeholder: L(locale, 'findPlaceholder'),
        options: allPieces(outfit).map(piece => ({ label: piece[locale], value: piece.id, emoji: 'search' })),
      })),
      ui.row(
        ui.button({ id: router.encode('fashion', 'reroll', owner, outfit.occasion, outfit.weather, outfit.requestedStyle ?? ''), label: L(locale, 'another'), emoji: 'shuffle', style: 'success' }),
        ui.button({ id: router.encode('fashion', 'guide', '*', outfit.style), label: L(locale, 'styleGuide', { style: pick(locale, style.name) }), emoji: style.emoji }),
      ),
    ],
  });
  return { card, files: [image.attachment] };
}

function findMessage(locale, piece, styleKey) {
  const style = data.STYLES[styleKey];
  const query = piece[locale];
  const links = shopLinks(query);
  const pinterest = { ...links[0], url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(`${query} ${style ? style.search : 'outfit'}`)}` };
  return ui.card({
    accent: 'peach',
    emoji: 'search',
    title: L(locale, 'findTitle', { piece: query }),
    body: [
      ui.quote(L(locale, 'findBody')),
      ui.row([pinterest, ...links.slice(1)].map(link => ui.button(link))),
      ui.sub(pick(locale, pickOne(data.TIP_TOPICS.shopping.tips))),
    ],
    footer: L(locale, 'findFooter'),
  });
}

function styleMessage(locale, key, owner) {
  const style = data.STYLES[key];
  const image = paletteImage(style.palette, `style-${key}.png`);
  const pieces = pick(locale, style.pieces).map(p => `• ${p}`).join('\n');
  const card = ui.card({
    accent: style.palette[0] === '#FFFFFF' ? style.palette[1] : style.palette[0],
    emoji: style.emoji,
    title: pick(locale, style.name),
    intro: ui.quote(pick(locale, style.vibe)),
    body: [
      'sep',
      `**${L(locale, 'keyPieces')}**\n${pieces}`,
      [
        ui.bullet('sparkle', L(locale, 'accessories'), pick(locale, style.accessories)),
        ui.bullet('star', L(locale, 'shoesLabel'), pick(locale, style.shoes)),
        ui.bullet('palette', L(locale, 'palette'), paletteNames(locale, style.palette)),
      ].join('\n'),
      ui.gallery({ url: image.url, description: paletteNames(locale, style.palette) }),
      ui.quote(`${ui.bullet('heart', L(locale, 'tipLabel'), pick(locale, style.tip))}\n${ui.bullet('warn', L(locale, 'avoidLabel'), pick(locale, style.avoid))}`),
      ui.sub(`${L(locale, 'muses')}: ${style.muses.join(' · ')}`),
      ui.row(
        ui.button({ url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(style.search)}`, label: 'Pinterest', emoji: 'sparkle' }),
        ui.button({ id: router.encode('fashion', 'styleoutfit', '*', key), label: L(locale, 'outfitWithStyle'), emoji: 'dress', style: 'success' }),
        ui.button({ id: router.encode('fashion', 'setstyle', '*', key), label: L(locale, 'useInProfile'), emoji: 'ribbon' }),
      ),
    ],
  });
  return { card, files: [image.attachment] };
}

function colorsMessage(locale, hex) {
  const base = colors.normalizeHex(hex);
  const named = colors.nearestName(base, locale);
  const temp = colors.temperature(base);
  const h = colors.harmonies(base);
  const rows = ['monochrome', 'analogous', 'complementary', 'triadic'];
  const image = ui.bufferAttachment(png.swatchRows(rows.map(key => h[key]), { rowHeight: 70, gap: 10, width: 640 }), 'harmonies.png');

  const neutralSets = {
    warm: ['#F5F0E6', '#C8A27A', '#5C4033', '#FFD700'],
    cool: ['#FFFFFF', '#808080', '#1F2A44', '#C0C0C1'],
    neutral: ['#000000', '#FFFFFF', '#F5E6CC', '#808080'],
  };

  const lines = [...rows, 'split'].map(key => `**${L(locale, `harmony.${key}`)}** · ${h[key].map(c => `\`${c}\``).join(' ')}\n-# ${L(locale, `harmonyHint.${key}`)}`);

  const card = ui.card({
    accent: base,
    emoji: 'palette',
    title: L(locale, 'colorsTitle', { name: named.name }),
    subtitle: L(locale, 'colorsSubtitle', { hex: base, temp: L(locale, `temps.${temp}`) }),
    body: [
      'sep',
      lines.join('\n'),
      ui.gallery({ url: image.url, description: L(locale, 'rowsNote') }),
      ui.sub(L(locale, 'rowsNote')),
      ui.bullet('sparkle', L(locale, 'neutralsTitle'), paletteNames(locale, neutralSets[temp])),
    ],
  });
  return { card, files: [image.attachment] };
}

/** Simplified four-season analysis. */
function colorSeason({ undertone, hair, eyes }) {
  const depth = ({ light: 0, medium: 1, dark: 2 }[hair] ?? 1) + ({ light: 0, dark: 1 }[eyes] ?? 0);
  const deep = depth >= 2;
  if (undertone === 'warm') return { season: deep ? 'autumn' : 'spring', alt: null };
  if (undertone === 'cool') return { season: deep ? 'winter' : 'summer', alt: null };
  return deep ? { season: 'autumn', alt: 'winter' } : { season: 'summer', alt: 'spring' };
}

function seasonMessage(locale, result) {
  const season = data.SEASONS[result.season];
  const image = ui.bufferAttachment(png.swatchRows([season.best.slice(0, 4), season.best.slice(4), season.neutrals], { rowHeight: 64, gap: 10 }), 'season.png');
  const card = ui.card({
    accent: season.best[0] === '#000000' ? '#0047AB' : season.best[0],
    emoji: season.emoji,
    title: L(locale, 'seasonTitle', { season: pick(locale, season.name) }),
    intro: ui.quote(pick(locale, season.about)),
    body: [
      'sep',
      [
        ui.bullet('heart', L(locale, 'bestColors'), paletteNames(locale, season.best)),
        ui.bullet('sparkle', L(locale, 'neutrals'), paletteNames(locale, season.neutrals)),
        ui.bullet('crown', L(locale, 'metal'), pick(locale, season.metal)),
        ui.bullet('warn', L(locale, 'avoidColors'), paletteNames(locale, season.avoid)),
      ].join('\n'),
      ui.gallery({ url: image.url, description: paletteNames(locale, season.best) }),
      result.alt ? ui.quote(L(locale, 'seasonAlt', { season: pick(locale, data.SEASONS[result.alt].name) })) : null,
      ui.sub(L(locale, 'undertoneHelp')),
    ],
  });
  return { card, files: [image.attachment] };
}

function tipMessage(locale, topicKey, owner, random = Math.random) {
  const topicName = topicKey || pickOne(Object.keys(data.TIP_TOPICS), random);
  const topic = data.TIP_TOPICS[topicName];
  return ui.card({
    accent: 'lavender',
    emoji: topic.emoji,
    title: L(locale, 'tipTitle', { topic: pick(locale, topic.name) }),
    body: [
      ui.quote(pick(locale, pickOne(topic.tips, random))),
      ui.row(ui.button({ id: router.encode('fashion', 'tip', owner, topicKey ?? ''), label: L(locale, 'anotherTip'), emoji: 'shuffle', style: 'success' })),
    ],
  });
}

// --------------------------------------------------------------------------- component handler

router.register('fashion', async (interaction, route, { locale }) => {
  const { action, args, owner } = route;

  if (action === 'reroll') {
    const [occasion, weather, style] = args;
    const outfit = generateOutfit({ occasion, weather, style: style || null });
    const { card, files } = outfitMessage(locale, outfit, owner);
    return interaction.update({ ...ui.forEdit(ui.message(card)), files, attachments: [] });
  }

  if (action === 'find') {
    const piece = data.WARDROBE.find(item => item.id === interaction.values[0]);
    if (!piece) return interaction.deferUpdate();
    return interaction.reply(ui.message(findMessage(locale, piece, args[0]), { ephemeral: true }));
  }

  if (action === 'guide') {
    if (!data.STYLES[args[0]]) return interaction.deferUpdate();
    const { card, files } = styleMessage(locale, args[0], interaction.user.id);
    return interaction.reply(ui.message(card, { files, ephemeral: true }));
  }

  if (action === 'styleoutfit') {
    if (!data.STYLES[args[0]]) return interaction.deferUpdate();
    const outfit = generateOutfit({ occasion: 'casual', weather: 'mild', style: args[0] });
    const { card, files } = outfitMessage(locale, outfit, interaction.user.id);
    return interaction.reply(ui.message(card, { files, ephemeral: true }));
  }

  if (action === 'setstyle') {
    const style = data.STYLES[args[0]];
    if (!style) return interaction.deferUpdate();
    db.setStyle(interaction.user.id, args[0]);
    return interaction.reply(ui.message(ui.notice('success', pick(locale, style.name), L(locale, 'profileSet', { style: pick(locale, style.name) })), { ephemeral: true }));
  }

  if (action === 'tip') {
    return interaction.update(ui.forEdit(ui.message(tipMessage(locale, args[0] || null, owner))));
  }

  return null;
});

module.exports = {
  data, generateOutfit, stylesFor, outfitMessage, findMessage, styleMessage, colorsMessage, colorSeason, seasonMessage,
  tipMessage, shopLinks,
};

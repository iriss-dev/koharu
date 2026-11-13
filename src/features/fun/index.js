'use strict';

/**
 * Small fun commands: the magic 8-ball, ship meter, rate, choose, dice,
 * avatar viewer and cute anime pictures (neko, waifu, kitsune, husbando).
 */

const crypto = require('crypto');
const ui = require('../../core/ui');
const router = require('../../core/router');
const { register, t } = require('../../core/i18n');
const kawaii = require('../../services/kawaii');
const { escapeMarkdown, cleanUserText, pickOne } = require('../../utils/text');

register('fun', {
  es: {
    ballTitle: 'La bola mágica',
    ballQuestion: '{e:help} {question}',
    ballAnswers: [
      'Sí, sin ninguna duda {e:sparkle}', 'Las estrellas dicen que sí {e:star}', 'Todo apunta a que sí', 'Definitivamente',
      'Puedes contar con ello {e:heart}', 'Lo más probable', 'Pregúntame de nuevo después de un tecito {e:coffee}', 'Mejor no te lo digo ahora…',
      'Ni yo lo sé, la verdad', 'Concéntrate y pregunta otra vez', 'No cuentes con ello', 'Mi respuesta es no {e:cross}',
      'Mis fuentes dicen que no', 'Muy dudoso…', 'Nyo~ ni de broma', '¡Obvio que sí!',
    ],
    shipTitle: 'Medidor de amor',
    shipName: 'Nombre de pareja: **{name}**',
    shipLevels: [
      'Ni amistad, solo vibras raras {e:cross}', 'Mejor como conocidos…', 'Hay una chispita, pero chiquita',
      'Buena amistad, ¿quizá algo más?', '¡Hay química! {e:sparkle}', 'Almas gemelas, se nota a kilómetros {e:hearts}',
      '¡Destinados! Que suenen las campanas {e:ribbon}',
    ],
    rateTitle: 'Mi puntuación',
    rate: 'Le doy a {thing} un **{score}/10** {e:star}',
    chooseTitle: 'Koharu elige',
    choose: 'Entre {count} opciones, elijo… **{choice}** {e:sparkle}',
    chooseUsage: 'Dame al menos dos opciones separadas por comas: `/elegir opciones: pizza, sushi, ramen`',
    rollTitle: 'Tirada de dados',
    roll: '{e:cards} {count}d{sides}: {rolls}\nTotal: **{total}**',
    avatarTitle: 'Avatar de {name}',
    serverAvatar: 'Avatar del servidor',
    globalAvatar: 'Avatar general',
    kawaiiTitle: {
      neko: 'Una neko para ti', waifu: 'Waifu del momento', kitsune: 'Una kitsune apareció', husbando: 'Husbando del momento',
    },
    artist: 'Arte de {artist}',
    another: 'Otra',
    source: 'Fuente',
    noPicture: 'No pude traer una imagen ahora mismo. Prueba otra vez en unos segundos.',
  },
  en: {
    ballTitle: 'The magic ball',
    ballQuestion: '{e:help} {question}',
    ballAnswers: [
      'Yes, without a doubt {e:sparkle}', 'The stars say yes {e:star}', 'Signs point to yes', 'Definitely',
      'You can count on it {e:heart}', 'Most likely', 'Ask me again after some tea {e:coffee}', 'Better not tell you now…',
      'Honestly, I do not know either', 'Concentrate and ask again', 'Do not count on it', 'My answer is no {e:cross}',
      'My sources say no', 'Very doubtful…', 'Nyo~ not a chance', 'Obviously yes!',
    ],
    shipTitle: 'Love meter',
    shipName: 'Ship name: **{name}**',
    shipLevels: [
      'Not even friends, just weird vibes {e:cross}', 'Better as acquaintances…', 'There is a spark, a tiny one',
      'Great friends, maybe something more?', 'There is chemistry! {e:sparkle}', 'Soulmates, you can tell from miles away {e:hearts}',
      'Meant to be! Ring the bells {e:ribbon}',
    ],
    rateTitle: 'My rating',
    rate: 'I give {thing} a **{score}/10** {e:star}',
    chooseTitle: 'Koharu chooses',
    choose: 'Out of {count} options, I choose… **{choice}** {e:sparkle}',
    chooseUsage: 'Give me at least two options separated by commas: `/choose options: pizza, sushi, ramen`',
    rollTitle: 'Dice roll',
    roll: '{e:cards} {count}d{sides}: {rolls}\nTotal: **{total}**',
    avatarTitle: '{name}\'s avatar',
    serverAvatar: 'Server avatar',
    globalAvatar: 'Global avatar',
    kawaiiTitle: {
      neko: 'A neko for you', waifu: 'Waifu of the moment', kitsune: 'A kitsune appeared', husbando: 'Husbando of the moment',
    },
    artist: 'Art by {artist}',
    another: 'Another',
    source: 'Source',
    noPicture: 'I could not fetch a picture right now. Try again in a few seconds.',
  },
});

const L = (locale, key, vars) => t(locale, `fun.${key}`, vars);

/** Stable 0–1 value for a text, so the same question always gets the same ship / rating. */
function stableRandom(text) {
  const hash = crypto.createHash('sha256').update(String(text)).digest();
  return hash.readUInt32BE(0) / 2 ** 32;
}

function eightBall(locale, question, random = Math.random) {
  const answer = pickOne(L(locale, 'ballAnswers'), random);
  const gif = kawaii.moodNow('thinking');
  return ui.message(ui.card({
    accent: 'lavender',
    emoji: 'moon',
    title: L(locale, 'ballTitle'),
    intro: `${L(locale, 'ballQuestion', { question: cleanUserText(question, 200) })}\n${ui.quote(`🎱 **${answer}**`)}`,
    thumbnail: gif?.url,
  }));
}

function shipPercent(idA, idB) {
  const [a, b] = [String(idA), String(idB)].sort();
  return Math.floor(stableRandom(`ship:${a}:${b}`) * 101);
}

function shipName(nameA, nameB) {
  const a = String(nameA).trim();
  const b = String(nameB).trim();
  return `${a.slice(0, Math.ceil(a.length / 2))}${b.slice(Math.floor(b.length / 2))}`;
}

async function shipMessage(locale, a, b) {
  const percent = a.id === b.id ? 100 : shipPercent(a.id, b.id);
  const levels = L(locale, 'shipLevels');
  const verdict = levels[Math.min(levels.length - 1, Math.floor((percent / 101) * levels.length))];
  const filled = Math.round(percent / 10);
  const bar = `${'💗'.repeat(filled)}${'🤍'.repeat(10 - filled)}`;
  const gif = await kawaii.mood(percent >= 60 ? 'love' : percent >= 30 ? 'thinking' : 'sad').catch(() => null);
  return ui.message(ui.card({
    accent: percent >= 60 ? 'rose' : percent >= 30 ? 'primary' : 'lavender',
    emoji: 'hearts',
    title: L(locale, 'shipTitle'),
    intro: [
      `**${escapeMarkdown(a.name)}** ${percent >= 50 ? '💞' : '💔'} **${escapeMarkdown(b.name)}**`,
      `## ${percent}%`,
      bar,
      ui.quote(verdict),
    ].join('\n'),
    thumbnail: gif?.url,
    footer: L(locale, 'shipName', { name: escapeMarkdown(shipName(a.name, b.name)) }),
  }));
}

function rateMessage(locale, thing) {
  const clean = cleanUserText(thing, 120);
  const score = Math.floor(stableRandom(`rate:${clean.toLowerCase()}`) * 11);
  const gif = kawaii.moodNow(score >= 7 ? 'win' : score >= 4 ? 'thinking' : 'no');
  return ui.message(ui.card({
    accent: score >= 7 ? 'mint' : score >= 4 ? 'gold' : 'error',
    emoji: 'star',
    title: L(locale, 'rateTitle'),
    intro: ui.quote(L(locale, 'rate', { thing: `**${clean}**`, score })),
    thumbnail: gif?.url,
  }));
}

function splitOptions(text) {
  const raw = String(text ?? '');
  const parts = raw.includes(',') || raw.includes('|') ? raw.split(/[,|]/) : raw.split(/\s+(?:o|or)\s+/i);
  return [...new Set(parts.map(part => part.trim()).filter(Boolean))].slice(0, 25);
}

function chooseMessage(locale, text, random = Math.random) {
  const options = splitOptions(text);
  if (options.length < 2) return ui.message(ui.notice('info', L(locale, 'chooseTitle'), L(locale, 'chooseUsage')), { ephemeral: true });
  const choice = cleanUserText(pickOne(options, random), 150);
  return ui.message(ui.card({
    accent: 'primary',
    emoji: 'wand',
    title: L(locale, 'chooseTitle'),
    intro: ui.quote(L(locale, 'choose', { count: options.length, choice })),
    thumbnail: kawaii.moodNow('yes')?.url,
  }));
}

function rollMessage(locale, { sides = 6, count = 1 } = {}, random = Math.random) {
  const s = Math.min(Math.max(Math.trunc(sides) || 6, 2), 1000);
  const c = Math.min(Math.max(Math.trunc(count) || 1, 1), 20);
  const rolls = Array.from({ length: c }, () => 1 + Math.floor(random() * s));
  return ui.message(ui.card({
    accent: 'sky',
    emoji: 'cards',
    title: L(locale, 'rollTitle'),
    intro: ui.quote(L(locale, 'roll', { count: c, sides: s, rolls: rolls.map(r => `\`${r}\``).join(' '), total: rolls.reduce((a, b) => a + b, 0) })),
  }));
}

function avatarMessage(locale, { user, member }) {
  const name = member?.displayName ?? user.globalName ?? user.username;
  const global = user.displayAvatarURL({ size: 1024, extension: 'png', forceStatic: false });
  const server = member?.avatar ? member.displayAvatarURL({ size: 1024, extension: 'png', forceStatic: false }) : null;
  const items = [{ url: global, description: L(locale, 'globalAvatar') }];
  if (server && server !== global) items.unshift({ url: server, description: L(locale, 'serverAvatar') });
  const links = [ui.button({ url: global, label: L(locale, 'globalAvatar'), emoji: 'link' })];
  if (server && server !== global) links.push(ui.button({ url: server, label: L(locale, 'serverAvatar'), emoji: 'link' }));
  return ui.message(ui.card({
    accent: member?.displayColor || 'primary',
    emoji: 'cat',
    title: L(locale, 'avatarTitle', { name: escapeMarkdown(name) }),
    body: [ui.gallery(items), ui.row(...links)],
  }));
}

const PICTURE_TYPES = ['neko', 'waifu', 'kitsune', 'husbando'];

async function pictureMessage(locale, type, ownerId) {
  const kind = PICTURE_TYPES.includes(type) ? type : 'neko';
  const item = await kawaii.gif(kind).catch(() => null);
  if (!item) return ui.message(ui.notice('error', L(locale, `kawaiiTitle.${kind}`), L(locale, 'noPicture')), { ephemeral: true });
  const buttons = [ui.button({ id: router.encode('fun', 'pic', ownerId, kind), label: L(locale, 'another'), emoji: 'shuffle', style: 'primary' })];
  if (item.source && /^https?:\/\//.test(item.source)) buttons.push(ui.button({ url: item.source, label: L(locale, 'source'), emoji: 'link' }));
  return ui.message(ui.card({
    accent: 'primary',
    emoji: kind === 'kitsune' ? 'moon' : kind === 'husbando' ? 'star' : 'cat',
    title: L(locale, `kawaiiTitle.${kind}`),
    body: [
      ui.gallery({ url: item.url, description: L(locale, `kawaiiTitle.${kind}`) }),
      item.artist ? ui.sub(L(locale, 'artist', { artist: escapeMarkdown(item.artist) })) : null,
      ui.row(...buttons),
    ],
  }));
}

router.register('fun', async (interaction, route, { locale }) => {
  if (route.action === 'pic') {
    return interaction.update(ui.forEdit(await pictureMessage(locale, route.args[0], route.owner)));
  }
  return null;
});

module.exports = {
  L, stableRandom, eightBall, shipPercent, shipName, shipMessage, rateMessage, splitOptions, chooseMessage, rollMessage,
  avatarMessage, pictureMessage, PICTURE_TYPES,
};

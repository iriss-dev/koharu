'use strict';

/**
 * Anime reactions and interactions (hug, pat, blush…) with GIFs from nekos.best,
 * per-pair counters and a "return it" button for the person on the receiving end.
 */

const ui = require('../../core/ui');
const router = require('../../core/router');
const { register, t } = require('../../core/i18n');
const nekos = require('../../services/nekos');
const db = require('../../database/db');
const { escapeMarkdown } = require('../../utils/text');

// key: nekos.best category. es/en: [singular noun, plural noun, sentence]
const ACTIONS = {
  hug: { emoji: 'hearts', aliases: ['hug', 'abrazo', 'abrazar'], es: ['abrazo', 'abrazos', '{a} abraza a {b}'], en: ['hug', 'hugs', '{a} hugs {b}'] },
  pat: { emoji: 'paw', aliases: ['pat', 'acariciar', 'caricia', 'headpat'], es: ['caricia', 'caricias', '{a} le acaricia la cabeza a {b}'], en: ['headpat', 'headpats', '{a} pats {b}'] },
  cuddle: { emoji: 'heart', aliases: ['cuddle', 'acurrucar', 'mimos'], es: ['mimo', 'mimos', '{a} se acurruca con {b}'], en: ['cuddle', 'cuddles', '{a} cuddles {b}'] },
  kiss: { emoji: 'heart', aliases: ['kiss', 'besar', 'beso'], es: ['beso', 'besos', '{a} besa a {b}'], en: ['kiss', 'kisses', '{a} kisses {b}'] },
  peck: { emoji: 'strawberry', aliases: ['peck', 'besito'], es: ['besito', 'besitos', '{a} le da un besito a {b}'], en: ['peck', 'pecks', '{a} gives {b} a little peck'] },
  handhold: { emoji: 'hearts', aliases: ['handhold', 'mano', 'tomarmano'], es: ['mano tomada', 'manos tomadas', '{a} toma la mano de {b}'], en: ['handhold', 'handholds', '{a} holds hands with {b}'] },
  highfive: { emoji: 'sparkle', aliases: ['highfive', 'chocalas', 'cinco'], es: ['choque de manos', 'choques de manos', '{a} choca los cinco con {b}'], en: ['high five', 'high fives', '{a} high-fives {b}'] },
  wave: { emoji: 'sakura', aliases: ['wave', 'saludar', 'hola'], es: ['saludo', 'saludos', '{a} saluda a {b}'], en: ['wave', 'waves', '{a} waves at {b}'] },
  poke: { emoji: 'paw', aliases: ['poke', 'picar', 'molestar'], es: ['toque', 'toques', '{a} le pica la mejilla a {b}'], en: ['poke', 'pokes', '{a} pokes {b}'] },
  tickle: { emoji: 'sparkle', aliases: ['tickle', 'cosquillas'], es: ['ataque de cosquillas', 'ataques de cosquillas', '{a} le hace cosquillas a {b}'], en: ['tickle attack', 'tickle attacks', '{a} tickles {b}'] },
  feed: { emoji: 'strawberry', aliases: ['feed', 'alimentar', 'dardecomer'], es: ['bocadito', 'bocaditos', '{a} le da de comer a {b}'], en: ['snack', 'snacks', '{a} feeds {b}'] },
  wink: { emoji: 'star', aliases: ['wink', 'guiñar', 'guino'], es: ['guiño', 'guiños', '{a} le guiña el ojo a {b}'], en: ['wink', 'winks', '{a} winks at {b}'] },
  stare: { emoji: 'cat', aliases: ['stare', 'mirar'], es: ['mirada fija', 'miradas fijas', '{a} mira fijamente a {b}'], en: ['stare', 'stares', '{a} stares at {b}'] },
  handshake: { emoji: 'sparkle', aliases: ['handshake', 'apretondemanos'], es: ['apretón de manos', 'apretones de manos', '{a} le estrecha la mano a {b}'], en: ['handshake', 'handshakes', '{a} shakes hands with {b}'] },
  baka: { emoji: 'warn', aliases: ['baka', 'tonto'], es: ['«¡baka!»', '«¡baka!»', '{a} le dice «¡baka!» a {b}'], en: ['“baka!”', '“baka!”s', '{a} calls {b} a baka'] },
  bite: { emoji: 'cat', aliases: ['bite', 'morder', 'mordida'], es: ['mordisco', 'mordiscos', '{a} le da un mordisquito a {b}'], en: ['nibble', 'nibbles', '{a} nibbles {b}'] },
  slap: { emoji: 'warn', aliases: ['slap', 'cachetada', 'bofetada'], es: ['cachetada', 'cachetadas', '{a} le da una cachetada a {b}'], en: ['slap', 'slaps', '{a} slaps {b}'] },
  kick: { emoji: 'warn', aliases: ['patada', 'patear', 'patadita'], es: ['patada', 'patadas', '{a} le da una patadita a {b}'], en: ['kick', 'kicks', '{a} kicks {b}'] },
  yeet: { emoji: 'fire', aliases: ['yeet', 'lanzar'], es: ['lanzamiento', 'lanzamientos', '{a} lanza a {b} por los aires'], en: ['yeet', 'yeets', '{a} yeets {b}'] },
};

// Solo reactions: es/en sentence with {a}.
const REACTIONS = {
  blush: { emoji: 'heart', aliases: ['blush', 'sonrojar', 'sonrojo'], es: '{a} se sonroja', en: '{a} blushes' },
  happy: { emoji: 'sparkle', aliases: ['happy', 'feliz'], es: '{a} está feliz', en: '{a} is happy' },
  smile: { emoji: 'sakura', aliases: ['smile', 'sonreir', 'sonrisa'], es: '{a} sonríe', en: '{a} smiles' },
  laugh: { emoji: 'star', aliases: ['laugh', 'reir', 'risa'], es: '{a} se ríe a carcajadas', en: '{a} bursts out laughing' },
  dance: { emoji: 'sparkle', aliases: ['dance', 'bailar', 'baile'], es: '{a} se pone a bailar', en: '{a} starts dancing' },
  cry: { emoji: 'moon', aliases: ['cry', 'llorar'], es: '{a} llora un poquito', en: '{a} is crying' },
  pout: { emoji: 'cat', aliases: ['pout', 'puchero', 'pucheros'], es: '{a} hace pucheros', en: '{a} pouts' },
  smug: { emoji: 'crown', aliases: ['smug', 'presumir'], es: '{a} pone cara de superioridad', en: '{a} looks smug' },
  think: { emoji: 'help', aliases: ['think', 'pensar'], es: '{a} se queda pensando', en: '{a} is thinking' },
  sleep: { emoji: 'moon', aliases: ['sleep', 'dormir'], es: '{a} se fue al mundo de los sueños… zzz', en: '{a} fell asleep… zzz' },
  yawn: { emoji: 'coffee', aliases: ['yawn', 'bostezar', 'bostezo'], es: '{a} bosteza', en: '{a} yawns' },
  nom: { emoji: 'strawberry', aliases: ['nom', 'comer', 'ñam'], es: '{a} está comiendo algo rico', en: '{a} is eating something tasty' },
  nod: { emoji: 'check', aliases: ['nod', 'asentir'], es: '{a} asiente', en: '{a} nods' },
  nope: { emoji: 'cross', aliases: ['nope', 'nop'], es: '{a} dice que nop', en: '{a} says nope' },
  shrug: { emoji: 'help', aliases: ['shrug', 'encogerse'], es: '{a} se encoge de hombros', en: '{a} shrugs' },
  facepalm: { emoji: 'warn', aliases: ['facepalm'], es: '{a} se lleva la mano a la cara', en: '{a} facepalms' },
  bored: { emoji: 'coffee', aliases: ['bored', 'aburrir', 'aburrimiento'], es: '{a} se aburre muchísimo', en: '{a} is so bored' },
  thumbsup: { emoji: 'check', aliases: ['thumbsup', 'like', 'pulgar'], es: '{a} da su aprobación', en: '{a} gives a thumbs up' },
  lurk: { emoji: 'cat', aliases: ['lurk', 'espiar'], es: '{a} observa desde las sombras', en: '{a} is lurking' },
  run: { emoji: 'fire', aliases: ['run', 'correr', 'huir'], es: '{a} sale corriendo', en: '{a} runs away' },
};

register('social', {
  es: {
    countFirst: '¡La primera vez entre {a} y {b}!',
    count: '{Nouns} de {a} para {b}: **{n}**',
    animeFrom: 'Anime: {anime}',
    returnLabel: 'Devolver',
    returned: '{e:hearts} ¡{name} se lo devolvió!',
    selfNote: 'Nadie se queda sin cariño: este va de parte de Koharu.',
    botNote: '{e:heart} Koharu se pone roja de la emoción.',
    usage: 'Usa `-abrazo @alguien` o `/interactuar`.',
    stats: 'Interacciones',
    given: 'Dadas',
    received: 'Recibidas',
  },
  en: {
    countFirst: 'The first {noun} from {a} to {b}!',
    count: '{Nouns} from {a} to {b}: **{n}**',
    animeFrom: 'Anime: {anime}',
    returnLabel: 'Return it',
    returned: '{e:hearts} {name} returned it!',
    selfNote: 'Nobody goes without some love: this one is from Koharu.',
    botNote: '{e:heart} Koharu turns pink with joy.',
    usage: 'Use `-hug @someone` or `/interact`.',
    stats: 'Interactions',
    given: 'Given',
    received: 'Received',
  },
});

const bold = name => `**${escapeMarkdown(name)}**`;

/**
 * @param {object} p
 * @param {string} p.locale
 * @param {string} p.action ACTIONS key
 * @param {{ id: string, name: string }} p.actor
 * @param {{ id: string, name: string, bot?: boolean }} p.target
 * @param {string|null} p.guildId
 * @param {string} p.botId
 */
async function actionMessage({ locale, action, actor, target, guildId, botId, returnable = true }) {
  const def = ACTIONS[action];
  const [noun, nouns, sentence] = def[locale];
  const isSelf = actor.id === target.id;
  const from = isSelf ? { id: botId, name: 'Koharu' } : actor;
  const to = isSelf ? actor : target;

  const lines = [];
  let count = null;
  if (guildId && !isSelf) count = db.recordInteraction(guildId, from.id, to.id, action);

  const gif = await nekos.gif(action);
  const subs = [];
  if (isSelf) subs.push(t(locale, 'social.selfNote'));
  else if (target.id === botId) subs.push(t(locale, 'social.botNote'));
  if (count) {
    subs.push(count === 1
      ? t(locale, 'social.countFirst', { noun, a: from.name, b: to.name })
      : t(locale, 'social.count', { n: count, Nouns: nouns.charAt(0).toUpperCase() + nouns.slice(1), a: from.name, b: to.name }));
  }
  if (gif?.anime) subs.push(t(locale, 'social.animeFrom', { anime: gif.anime }));
  lines.push(ui.heading(def.emoji, sentence.replace('{a}', bold(from.name)).replace('{b}', bold(to.name))));

  const body = [];
  if (gif) body.push(ui.gallery({ url: gif.url, description: sentence.replace('{a}', from.name).replace('{b}', to.name) }));
  if (subs.length) body.push(ui.sub(subs.join(' · ')));
  if (returnable && !isSelf && target.id !== botId && !target.bot) {
    body.push(ui.row(ui.button({
      id: router.encode('social', 'return', to.id, action, from.id),
      label: t(locale, 'social.returnLabel'),
      emoji: def.emoji,
      style: 'primary',
    })));
  }

  return ui.message(ui.card({ accent: 'primary', body: [lines.join('\n'), ...body] }));
}

async function reactionMessage({ locale, reaction, actor }) {
  const def = REACTIONS[reaction];
  const gif = await nekos.gif(reaction);
  const body = [ui.heading(def.emoji, def[locale].replace('{a}', bold(actor.name)))];
  if (gif) body.push(ui.gallery({ url: gif.url, description: def[locale].replace('{a}', actor.name) }));
  if (gif?.anime) body.push(ui.sub(t(locale, 'social.animeFrom', { anime: gif.anime })));
  return ui.message(ui.card({ accent: 'lavender', body }));
}

router.register('social', async (interaction, route, { locale }) => {
  if (route.action !== 'return') return null;
  const [action, originalActorId] = route.args;
  if (!ACTIONS[action]) return null;

  // Disable the button on the original message, then post the returned action.
  await interaction.update({ components: ui.disableIn(interaction.message.components, id => id === interaction.customId) });

  const guild = interaction.guild;
  const original = guild ? await guild.members.fetch(originalActorId).catch(() => null) : null;
  const originalName = original?.displayName ?? (await interaction.client.users.fetch(originalActorId).catch(() => null))?.username ?? '…';
  const payload = await actionMessage({
    locale,
    action,
    actor: { id: interaction.user.id, name: interaction.member?.displayName ?? interaction.user.username },
    target: { id: originalActorId, name: originalName },
    guildId: guild?.id ?? null,
    botId: interaction.client.user.id,
  });
  return interaction.followUp(payload);
});

/** Prefix aliases → presets for the two commands. */
function presets(table) {
  const out = {};
  for (const [key, def] of Object.entries(table)) for (const alias of def.aliases) out[alias] = { options: { type: key } };
  return out;
}

module.exports = { ACTIONS, REACTIONS, actionMessage, reactionMessage, presets };

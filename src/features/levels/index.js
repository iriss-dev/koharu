'use strict';

/**
 * Levels per server: members earn 15–25 XP for chatting (at most once a
 * minute, so spam does not pay), level up with a cute anime GIF and a coin
 * reward, and can compare themselves with /nivel and /nivel top.
 *
 * XP for the next level follows 5·L² + 50·L + 100, so early levels come fast
 * and later ones take real activity.
 */

const ui = require('../../core/ui');
const router = require('../../core/router');
const emojis = require('../../core/emojis');
const { register, t } = require('../../core/i18n');
const db = require('../../database/db');
const kawaii = require('../../services/kawaii');
const { formatNumber, escapeMarkdown } = require('../../utils/text');

register('levels', {
  es: {
    title: 'Nivel de {name}',
    level: 'Nivel',
    xp: 'Experiencia',
    rank: 'Puesto',
    rankValue: '#{rank} del servidor',
    messages: 'Mensajes',
    next: 'Faltan **{xp}** XP para el nivel {level}',
    levelUpTitle: '¡Subiste de nivel!',
    levelUp: '{e:sparkle} {user} ahora es **nivel {level}**. ¡Felicidades!',
    reward: '{e:coin} Premio: **{amount}** monedas',
    topTitle: 'Ranking de niveles',
    topEmpty: 'Todavía nadie gana experiencia aquí. ¡A charlar!',
    yourRank: 'Tú: #{rank} · nivel {level}',
    disabled: 'Los niveles están desactivados en este servidor. Un admin puede activarlos con `/config niveles`.',
    howTo: 'Ganas XP conversando (una vez por minuto). Cada nivel trae monedas de premio.',
  },
  en: {
    title: '{name}\'s level',
    level: 'Level',
    xp: 'Experience',
    rank: 'Rank',
    rankValue: '#{rank} in this server',
    messages: 'Messages',
    next: '**{xp}** XP to level {level}',
    levelUpTitle: 'Level up!',
    levelUp: '{e:sparkle} {user} is now **level {level}**. Congratulations!',
    reward: '{e:coin} Reward: **{amount}** coins',
    topTitle: 'Level ranking',
    topEmpty: 'Nobody has earned XP here yet. Start chatting!',
    yourRank: 'You: #{rank} · level {level}',
    disabled: 'Levels are turned off in this server. An admin can turn them on with `/settings levels`.',
    howTo: 'You earn XP by chatting (once a minute). Every level comes with a coin reward.',
  },
});

const L = (locale, key, vars) => t(locale, `levels.${key}`, vars);

const XP_MIN = 15;
const XP_MAX = 25;
const XP_COOLDOWN = 60;
const REWARD_PER_LEVEL = 100;

/** XP needed to go from `level` to `level + 1`. */
const xpForNext = level => 5 * level * level + 50 * level + 100;

/** Level, XP inside the level and XP needed for the next one, from total XP. */
function levelInfo(totalXp) {
  let level = 0;
  let rest = Math.max(0, Math.floor(totalXp));
  while (rest >= xpForNext(level)) {
    rest -= xpForNext(level);
    level += 1;
  }
  return { level, current: rest, needed: xpForNext(level), total: Math.floor(totalXp) };
}

/** Total XP at which a level starts. */
function xpForLevel(level) {
  let total = 0;
  for (let l = 0; l < level; l++) total += xpForNext(l);
  return total;
}

/** Pastel progress bar: ▰▰▰▱▱▱▱▱▱▱ */
function progressBar(current, needed, size = 12) {
  const filled = Math.max(0, Math.min(size, Math.round((current / Math.max(needed, 1)) * size)));
  return `${'▰'.repeat(filled)}${'▱'.repeat(size - filled)}`;
}

/**
 * Called for every guild message. Grants XP and announces level-ups.
 * @returns {Promise<{ levelUp: boolean, level: number } | null>}
 */
async function onMessage(message, locale, { random = Math.random, at } = {}) {
  if (!message.guild || message.author?.bot) return null;
  const settings = db.guildSettings(message.guild.id);
  if (!settings.levels_enabled) return null;
  const amount = XP_MIN + Math.floor(random() * (XP_MAX - XP_MIN + 1));
  const result = db.gainXp(message.guild.id, message.author.id, amount, at, XP_COOLDOWN);
  if (!result.gained) return null;
  const before = levelInfo(result.before).level;
  const after = levelInfo(result.after).level;
  if (after <= before) return { levelUp: false, level: after };

  const reward = after * REWARD_PER_LEVEL;
  db.addCoins(message.guild.id, message.author.id, reward);
  const payload = await levelUpMessage(locale, { user: message.author, member: message.member, level: after, reward });

  const target = settings.levelup_channel_id
    ? message.guild.channels.cache.get(settings.levelup_channel_id) ?? await message.guild.channels.fetch(settings.levelup_channel_id).catch(() => null)
    : message.channel;
  await target?.send?.(payload).catch(() => null);
  return { levelUp: true, level: after };
}

async function levelUpMessage(locale, { user, member, level, reward }) {
  const gif = await kawaii.mood('levelup').catch(() => null);
  const name = escapeMarkdown(member?.displayName ?? user.globalName ?? user.username);
  const card = ui.card({
    accent: 'gold',
    emoji: 'trophy',
    title: L(locale, 'levelUpTitle'),
    intro: [ui.quote(L(locale, 'levelUp', { user: `<@${user.id}>`, level })), L(locale, 'reward', { amount: formatNumber(locale, reward) })].join('\n'),
    thumbnail: gif?.url ?? user.displayAvatarURL?.({ size: 256, extension: 'png' }),
    footer: name,
  });
  return { ...ui.message(card), allowedMentions: { users: [user.id] } };
}

function rankMessage(locale, { guild, user, member }) {
  const settings = db.guildSettings(guild.id);
  const row = db.level(guild.id, user.id);
  const info = levelInfo(row.xp);
  const name = escapeMarkdown(member?.displayName ?? user.globalName ?? user.username);
  const lines = [
    ui.bullet('star', L(locale, 'level'), `**${info.level}**`),
    ui.bullet('sparkle', L(locale, 'xp'), `${formatNumber(locale, info.current)} / ${formatNumber(locale, info.needed)} · ${formatNumber(locale, info.total)} total`),
    `\`${progressBar(info.current, info.needed)}\` ${Math.floor((info.current / info.needed) * 100)}%`,
  ];
  if (row.xp > 0) lines.push(ui.bullet('trophy', L(locale, 'rank'), L(locale, 'rankValue', { rank: db.levelRank(guild.id, user.id) })));
  lines.push(ui.bullet('chat', L(locale, 'messages'), formatNumber(locale, row.messages)));

  return ui.message(ui.card({
    accent: member?.displayColor || 'lavender',
    emoji: 'trophy',
    title: L(locale, 'title', { name }),
    subtitle: `@${user.username}`,
    intro: lines.join('\n'),
    thumbnail: user.displayAvatarURL({ size: 256, extension: 'png' }),
    body: [ui.sub(settings.levels_enabled
      ? `${L(locale, 'next', { xp: formatNumber(locale, info.needed - info.current), level: info.level + 1 })} · ${L(locale, 'howTo')}`
      : L(locale, 'disabled'))],
  }));
}

const PER_PAGE = 10;

async function topMessage(locale, guild, viewerId, page = 0) {
  const total = db.levelCount(guild.id);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const rows = db.levelTop(guild.id, PER_PAGE, current * PER_PAGE);
  if (!rows.length) return ui.message(ui.notice('info', L(locale, 'topTitle'), L(locale, 'topEmpty')));

  const members = await guild.members.fetch({ user: rows.map(r => r.user_id) }).catch(() => null);
  const medals = ['crown', 'trophy', 'star'];
  const lines = rows.map((row, i) => {
    const position = current * PER_PAGE + i + 1;
    const member = members?.get?.(row.user_id);
    const name = escapeMarkdown(member?.displayName ?? `#${row.user_id.slice(-4)}`);
    const badge = position <= 3 ? emojis.e(medals[position - 1]) : `\`#${position}\``;
    const info = levelInfo(row.xp);
    return `${badge} **${name}** · ${L(locale, 'level')} ${info.level} · ${formatNumber(locale, row.xp)} XP`;
  });
  const viewer = db.level(guild.id, viewerId);
  const body = ['sep', lines.join('\n')];
  if (viewer.xp > 0) body.push(ui.sub(L(locale, 'yourRank', { rank: db.levelRank(guild.id, viewerId), level: levelInfo(viewer.xp).level })));
  if (pages > 1) {
    body.push(ui.row(
      ui.button({ id: router.encode('lvl', 'top', '*', current - 1), emoji: 'arrow_left', disabled: current === 0 }),
      ui.button({ id: router.encode('lvl', 'noop', '*'), label: t(locale, 'common.page', { page: current + 1, pages }), disabled: true }),
      ui.button({ id: router.encode('lvl', 'top', '*', current + 1), emoji: 'arrow_right', disabled: current >= pages - 1 }),
    ));
  }
  const gif = kawaii.moodNow('levelup');
  return ui.message(ui.card({ accent: 'gold', emoji: 'trophy', title: L(locale, 'topTitle'), subtitle: guild.name, thumbnail: gif?.url, body }));
}

router.register('lvl', async (interaction, route, { locale }) => {
  if (route.action === 'top') {
    return interaction.update(ui.forEdit(await topMessage(locale, interaction.guild, interaction.user.id, Number(route.args[0]) || 0)));
  }
  return interaction.deferUpdate();
});

module.exports = { L, xpForNext, xpForLevel, levelInfo, progressBar, onMessage, levelUpMessage, rankMessage, topMessage, XP_COOLDOWN, REWARD_PER_LEVEL };

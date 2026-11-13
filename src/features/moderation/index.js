'use strict';

/**
 * Shared moderation logic: permission and hierarchy checks, the case card, a
 * private notice to the member and an entry in the server's moderation log.
 */

const { PermissionFlagsBits } = require('discord.js');
const ui = require('../../core/ui');
const { register, t } = require('../../core/i18n');
const db = require('../../database/db');
const { cleanUserText, escapeMarkdown } = require('../../utils/text');
const kawaii = require('../../services/kawaii');
require('../social'); // registers social.animeFrom used in the footer

const ACTION_EMOJI = { ban: 'shield', kick: 'paw', timeout: 'clock', untimeout: 'sparkle', warn: 'warn', purge: 'sparkle', slowmode: 'coffee' };

register('mod', {
  es: {
    actions: {
      ban: 'Miembro baneado', kick: 'Miembro expulsado', timeout: 'Miembro aislado', untimeout: 'Aislamiento retirado',
      warn: 'Advertencia', purge: 'Mensajes borrados', slowmode: 'Modo lento',
    },
    user: 'Usuario',
    moderator: 'Moderación',
    reason: 'Motivo',
    duration: 'Duración',
    total: 'Advertencias en total',
    noReason: 'Sin motivo indicado',
    self: 'No puedes aplicarte esto a tu propia cuenta.',
    owner: 'No puedo hacerle eso a la persona dueña del servidor.',
    botHierarchy: 'No puedo: su rol está por encima del mío o igual.',
    modHierarchy: 'No puedes: su rol está por encima del tuyo o igual.',
    notMember: 'Esa persona no está en el servidor.',
    dm: '{e:shield} Recibiste una acción de moderación en **{guild}**: {action}.\n**Motivo:** {reason}',
    badDuration: 'Duración no válida. Usa algo como `10m`, `2h`, `1d` (máximo 28 días).',
    purged: 'Borré **{n}** mensajes{from}.',
    purgedFrom: ' de {user}',
    purgeOld: 'Discord no permite borrar en bloque mensajes de más de 14 días.',
    slowmodeSet: 'Modo lento en {channel}: **{seconds} s** entre mensajes.',
    slowmodeOff: 'Modo lento desactivado en {channel}.',
    warnList: 'Historial de {user}',
    warnEmpty: '{e:sparkle} Historial limpio: sin advertencias.',
    warnCleared: 'Borré {n} advertencias de {user}.',
    warnRemoved: 'Quité la advertencia **#{n}** de {user}.',
    warnNotFound: 'No encontré la advertencia **#{n}** de {user}. Mira los números con `/advertir ver`.',
    manyWarns: '· ¡cuidado! {e:fire}',
    dmFooter: 'Si crees que fue un error, habla con el equipo de moderación con calma.',
  },
  en: {
    actions: {
      ban: 'Member banned', kick: 'Member kicked', timeout: 'Member timed out', untimeout: 'Timeout removed',
      warn: 'Warning', purge: 'Messages deleted', slowmode: 'Slowmode',
    },
    user: 'User',
    moderator: 'Moderator',
    reason: 'Reason',
    duration: 'Duration',
    total: 'Total warnings',
    noReason: 'No reason given',
    self: 'You cannot do this to your own account.',
    owner: 'I cannot do that to the server owner.',
    botHierarchy: 'I cannot: their role is higher than or equal to mine.',
    modHierarchy: 'You cannot: their role is higher than or equal to yours.',
    notMember: 'That person is not in this server.',
    dm: '{e:shield} You received a moderation action in **{guild}**: {action}.\n**Reason:** {reason}',
    badDuration: 'Invalid duration. Use something like `10m`, `2h`, `1d` (28 days max).',
    purged: 'Deleted **{n}** messages{from}.',
    purgedFrom: ' from {user}',
    purgeOld: 'Discord does not allow bulk-deleting messages older than 14 days.',
    slowmodeSet: 'Slowmode in {channel}: **{seconds}s** between messages.',
    slowmodeOff: 'Slowmode turned off in {channel}.',
    warnList: '{user}\'s record',
    warnEmpty: '{e:sparkle} Clean record: no warnings.',
    warnCleared: 'Cleared {n} warnings for {user}.',
    warnRemoved: 'Removed warning **#{n}** from {user}.',
    warnNotFound: 'I could not find warning **#{n}** for {user}. See the numbers with `/warn list`.',
    manyWarns: '· careful! {e:fire}',
    dmFooter: 'If you think this was a mistake, talk to the moderators calmly.',
  },
});

const L = (locale, key, vars) => t(locale, `mod.${key}`, vars);

const PERMISSION_NAMES = {
  [PermissionFlagsBits.BanMembers]: 'Ban Members',
  [PermissionFlagsBits.KickMembers]: 'Kick Members',
  [PermissionFlagsBits.ModerateMembers]: 'Moderate Members',
  [PermissionFlagsBits.ManageMessages]: 'Manage Messages',
  [PermissionFlagsBits.ManageChannels]: 'Manage Channels',
};

/** Returns an error payload when the moderator lacks a permission, else null. */
function requirePermission(ctx, permission) {
  if (ctx.member?.permissions?.has(permission)) return null;
  return ui.message(ui.notice('error', t(ctx.locale, 'common.errorTitle'), t(ctx.locale, 'common.missingPerm', { perm: PERMISSION_NAMES[permission] ?? 'Moderator' })), { ephemeral: true });
}

/**
 * Hierarchy checks shared by ban / kick / timeout.
 * @param {'bannable'|'kickable'|'moderatable'} capability
 */
function checkTarget(ctx, targetUser, targetMember, capability) {
  const deny = key => ui.message(ui.notice('warn', t(ctx.locale, 'common.errorTitle'), L(ctx.locale, key)), { ephemeral: true });
  if (targetUser.id === ctx.user.id) return deny('self');
  if (targetUser.id === ctx.guild.ownerId) return deny('owner');
  if (!targetMember) return capability === 'bannable' ? null : deny('notMember');
  if (!targetMember[capability]) return deny('botHierarchy');
  if (ctx.member.id !== ctx.guild.ownerId && ctx.member.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) return deny('modHierarchy');
  return null;
}

// Local picture used only when the GIF services are unreachable.
const FALLBACK = 'yui_glass.png';

/**
 * Picks the cute anime GIF for a case once, so the reply and the log show the same one.
 * @returns {Promise<{ url: string, files: any[], anime: string|null }>}
 */
async function caseMedia(action) {
  const gif = await kawaii.mood(action).catch(() => null);
  if (gif) return { url: gif.url, files: [], anime: gif.anime };
  const local = ui.asset(FALLBACK);
  return { url: local.url, files: [local.attachment], anime: null };
}

/**
 * The case card: details on the left, a small anime GIF on the right.
 * @param {string} locale
 * @param {object} payload
 * @param {{ url: string, files: any[], anime?: string|null }} media
 */
function caseCard(locale, { action, target, moderator, reason, duration, total, caseId }, media) {
  const lines = [
    ui.bullet('cat', L(locale, 'user'), `<@${target.id}> \`${target.id}\``),
    ui.bullet('shield', L(locale, 'moderator'), `<@${moderator.id}>`),
  ];
  if (duration) lines.push(ui.bullet('clock', L(locale, 'duration'), duration));
  lines.push(ui.bullet('chat', L(locale, 'reason'), reason ? cleanUserText(reason, 300) : L(locale, 'noReason')));
  if (total) lines.push(ui.bullet('warn', L(locale, 'total'), `**${total}**${total >= 3 ? ` ${L(locale, 'manyWarns')}` : ''}`));
  const accent = { ban: 'error', kick: 'rose', timeout: 'rose', warn: 'gold', untimeout: 'mint' }[action] ?? 'lavender';
  const footer = [caseId ? `#${caseId}` : null, media.anime ? t(locale, 'social.animeFrom', { anime: media.anime }) : null].filter(Boolean).join(' · ');
  return {
    card: ui.card({
      accent,
      emoji: ACTION_EMOJI[action] ?? 'shield',
      title: L(locale, `actions.${action}`),
      intro: ui.quote(lines.join('\n')),
      thumbnail: media.url,
      thumbnailAlt: L(locale, `actions.${action}`),
      footer: footer || undefined,
    }),
    files: media.files,
  };
}

/** Posts the case card to the configured moderation log, if any. */
async function logCase(guild, locale, payload, media) {
  const channelId = db.guildSettings(guild.id).mod_log_channel_id;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;
  const fresh = caseCard(locale, payload, media ?? await caseMedia(payload.action));
  // Attachments are single-use: rebuild local files for the log copy.
  const files = fresh.files.length ? [ui.asset(FALLBACK).attachment] : [];
  await channel.send(ui.message(fresh.card, { files })).catch(() => null);
}

async function notifyMember(user, locale, { guild, action, reason }) {
  const text = L(locale, 'dm', { guild: escapeMarkdown(guild.name), action: L(locale, `actions.${action}`).toLowerCase(), reason: reason ? cleanUserText(reason, 300) : L(locale, 'noReason') });
  // Cached pictures only: a DM must never hold up the moderation action.
  const gif = kawaii.moodNow(action);
  const card = ui.card({
    accent: 'lavender',
    emoji: ACTION_EMOJI[action] ?? 'shield',
    title: L(locale, `actions.${action}`),
    intro: ui.quote(text),
    thumbnail: gif?.url,
    footer: L(locale, 'dmFooter'),
  });
  await user.send(ui.message(card)).catch(() => null);
}

/** Replies with the case card and mirrors it to the moderation log. */
async function respond(ctx, payload) {
  await ctx.defer();
  const media = await caseMedia(payload.action);
  const { card, files } = caseCard(ctx.locale, payload, media);
  await logCase(ctx.guild, ctx.locale, payload, media);
  return ctx.reply(ui.message(card, { files }));
}

module.exports = { L, requirePermission, checkTarget, caseCard, caseMedia, logCase, notifyMember, respond, ACTION_EMOJI };

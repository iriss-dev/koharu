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

function caseCard(locale, { action, target, moderator, reason, duration, total }) {
  const yui = ui.asset('yui_glass.png');
  const lines = [
    ui.bullet('cat', L(locale, 'user'), `<@${target.id}> \`${target.id}\``),
    ui.bullet('shield', L(locale, 'moderator'), `<@${moderator.id}>`),
  ];
  if (duration) lines.push(ui.bullet('clock', L(locale, 'duration'), duration));
  lines.push(ui.bullet('chat', L(locale, 'reason'), reason ? cleanUserText(reason, 300) : L(locale, 'noReason')));
  if (total) lines.push(ui.bullet('warn', L(locale, 'total'), `**${total}**`));
  const accent = { ban: 'error', kick: 'rose', timeout: 'rose', warn: 'gold' }[action] ?? 'lavender';
  return {
    card: ui.card({ accent, emoji: 'shield', title: L(locale, `actions.${action}`), body: [ui.quote(lines.join('\n')), ui.gallery({ url: yui.url, description: L(locale, `actions.${action}`) })] }),
    files: [yui.attachment],
  };
}

/** Posts the case card to the configured moderation log, if any. */
async function logCase(guild, locale, payload) {
  const channelId = db.guildSettings(guild.id).mod_log_channel_id;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;
  const fresh = caseCard(locale, payload);
  await channel.send(ui.message(fresh.card, { files: fresh.files })).catch(() => null);
}

async function notifyMember(user, locale, { guild, action, reason }) {
  const text = L(locale, 'dm', { guild: escapeMarkdown(guild.name), action: L(locale, `actions.${action}`).toLowerCase(), reason: reason ? cleanUserText(reason, 300) : L(locale, 'noReason') });
  await user.send(ui.message(ui.card({ accent: 'lavender', body: [text] }))).catch(() => null);
}

/** Replies with the case card and mirrors it to the moderation log. */
async function respond(ctx, payload) {
  const { card, files } = caseCard(ctx.locale, payload);
  await logCase(ctx.guild, ctx.locale, payload);
  return ctx.reply(ui.message(card, { files }));
}

module.exports = { L, requirePermission, checkTarget, caseCard, logCase, notifyMember, respond };

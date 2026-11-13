'use strict';

/**
 * Welcome cards for new members: a custom (or default) message, their avatar
 * and a cute anime "hello" GIF. Needs the Server Members intent.
 */

const ui = require('../../core/ui');
const { register, t } = require('../../core/i18n');
const db = require('../../database/db');
const kawaii = require('../../services/kawaii');
const { escapeMarkdown, stripMentions, formatNumber } = require('../../utils/text');

register('welcome', {
  es: {
    title: '¡Te damos la bienvenida a {server}!',
    default: '{e:sakura} ¡Hola, {user}! Qué alegría tenerte aquí. Ponte a gusto, lee las reglas y saluda a todos {e:sparkle}',
    count: 'Eres el miembro número {count}',
  },
  en: {
    title: 'Welcome to {server}!',
    default: '{e:sakura} Hi, {user}! So happy to have you here. Make yourself at home, read the rules and say hi {e:sparkle}',
    count: 'You are member number {count}',
  },
});

const L = (locale, key, vars) => t(locale, `welcome.${key}`, vars);

/** Fills {user}, {server} and {count} in an admin-written message without allowing mass pings. */
function fill(template, { user, guild, locale }) {
  return stripMentions(String(template))
    .replaceAll('{user}', `<@${user.id}>`)
    .replaceAll('{server}', escapeMarkdown(guild.name))
    .replaceAll('{count}', formatNumber(locale, guild.memberCount ?? 0));
}

async function welcomeMessage(locale, { member, user, guild }) {
  const settings = db.guildSettings(guild.id);
  const text = settings.welcome_message
    ? fill(settings.welcome_message, { user, guild, locale })
    : L(locale, 'default', { user: `<@${user.id}>` });
  const gif = await kawaii.mood('hello').catch(() => null);
  const body = [];
  if (gif) body.push(ui.gallery({ url: gif.url, description: L(locale, 'title', { server: guild.name }) }));
  const card = ui.card({
    accent: member?.displayColor || 'primary',
    emoji: 'sakura',
    title: L(locale, 'title', { server: escapeMarkdown(guild.name) }),
    intro: ui.quote(text),
    thumbnail: user.displayAvatarURL?.({ size: 256, extension: 'png' }),
    body,
    footer: guild.memberCount ? L(locale, 'count', { count: formatNumber(locale, guild.memberCount) }) : undefined,
  });
  return { ...ui.message(card), allowedMentions: { users: [user.id] } };
}

module.exports = { L, fill, welcomeMessage };

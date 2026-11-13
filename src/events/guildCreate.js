'use strict';

const { Events, PermissionFlagsBits, ChannelType } = require('discord.js');
const ui = require('../core/ui');
const { pick, normalize } = require('../core/i18n');
const config = require('../config');

/** Says hello in the first channel Koharu can write in when added to a server. */
module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    const me = guild.members.me;
    const canWrite = channel => channel?.type === ChannelType.GuildText && channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
    const channel = [guild.systemChannel, ...guild.channels.cache.sort((a, b) => a.rawPosition - b.rawPosition).values()].find(canWrite);
    if (!channel) return;

    const locale = normalize(guild.preferredLocale) ?? config.defaultLocale;
    const card = ui.card({
      accent: 'primary',
      emoji: 'sakura',
      title: pick(locale, { es: '¡Hola! Soy Koharu', en: 'Hi! I am Koharu' }),
      intro: ui.quote(pick(locale, {
        es: 'Gracias por invitarme. Traigo anime, moda, ofertas, economía, roles personalizados y moderación, todo con mucho cariño.',
        en: 'Thanks for inviting me. I bring anime, fashion, deals, economy, custom roles and moderation, all with lots of love.',
      })),
      body: [
        'sep',
        pick(locale, {
          es: '• `/ayuda` para ver todo lo que sé hacer\n• `/config idioma` para elegir español o inglés\n• `/panelroles publicar` para el panel de roles\n• `/ofertas canal` para recibir juegos gratis automáticamente',
          en: '• `/help` to see everything I can do\n• `/settings language` to choose English or Spanish\n• `/rolepanel setup` for the custom role panel\n• `/deals channel` to get free games posted automatically',
        }),
      ],
    });
    await channel.send(ui.message(card)).catch(() => null);
  },
};

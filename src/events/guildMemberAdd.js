'use strict';

const { Events } = require('discord.js');
const db = require('../database/db');
const { localeFor } = require('../core/context');
const welcome = require('../features/welcome');

/** Posts the welcome card when the server set a channel with /config bienvenida. */
module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (member.user?.bot) return;
    const settings = db.guildSettings(member.guild.id);
    if (!settings.welcome_channel_id) return;
    const channel = member.guild.channels.cache.get(settings.welcome_channel_id)
      ?? await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
    if (!channel?.isTextBased?.()) return;
    const locale = localeFor({ guild: member.guild, locale: null }, settings);
    const payload = await welcome.welcomeMessage(locale, { member, user: member.user, guild: member.guild });
    await channel.send(payload).catch(() => null);
  },
};

'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const args = require('../../core/args');
const fun = require('../../features/fun');

const data = loc(new SlashCommandBuilder(), ['avatar', 'avatar'], ['See someone\'s avatar in full size', 'Mira el avatar de alguien en grande'])
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Whose avatar', 'De quién']));

module.exports = {
  data,
  category: 'fun',
  emoji: 'cat',

  prefix: {
    aliases: ['av', 'pfp', 'foto'],
    async parse(message, rawArgs) {
      return { options: { user: (await args.user(message, rawArgs[0])) ?? null } };
    },
  },

  async run(ctx) {
    const user = ctx.opt.user('user') ?? ctx.user;
    const member = ctx.guild ? await ctx.guild.members.fetch(user.id).catch(() => null) : null;
    return ctx.reply(fun.avatarMessage(ctx.locale, { user, member }));
  },
};

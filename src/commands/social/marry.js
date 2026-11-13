'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const marriage = require('../../features/marriage');

const data = loc(new SlashCommandBuilder(), ['marry', 'casarse'], ['Propose to someone, anime style', 'Pídele matrimonio a alguien, al estilo anime'])
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who you want to marry', 'Con quién te quieres casar']).setRequired(true));

module.exports = {
  data,
  category: 'social',
  emoji: 'ribbon',
  cooldown: 10,

  prefix: {
    aliases: ['casar', 'propose', 'proponer', 'boda'],
    async parse(message, rawArgs) {
      return { options: { user: (await args.user(message, rawArgs[0])) ?? message.mentions.users.first() ?? null } };
    },
  },

  async run(ctx) {
    const target = ctx.opt.user('user');
    if (!target) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/casarse usuario:` · `-marry @alguien`'), { ephemeral: true }));
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    const from = { id: ctx.user.id, name: ctx.displayName };
    const to = { id: target.id, name: member?.displayName ?? target.globalName ?? target.username, bot: target.bot };
    const denied = marriage.checkProposal(ctx.locale, { from, to });
    if (denied) return ctx.reply(denied);
    await ctx.defer();
    const payload = await marriage.proposalMessage(ctx.locale, { from, to });
    // Ping the person being asked so they see it.
    return ctx.reply({ ...payload, allowedMentions: { users: [target.id] } });
  },
};

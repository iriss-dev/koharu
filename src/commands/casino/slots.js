'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const db = require('../../database/db');
const config = require('../../config');
const casino = require('../../features/casino');

const data = loc(new SlashCommandBuilder(), ['slots', 'tragamonedas'], ['Spin the cute slot machine', 'Gira la tragamonedas más tierna'])
  .addIntegerOption(opt => loc(opt, ['bet', 'apuesta'], ['Coins to bet', 'Monedas que apuestas']).setRequired(true).setMinValue(config.economy.minBet).setMaxValue(config.economy.maxBet));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  data,
  category: 'casino',
  emoji: 'slot',

  prefix: {
    aliases: ['slot', 'tragaperras'],
    parse(message, rawArgs) {
      const parsed = args.amount(rawArgs[0] ?? '');
      const wallet = db.member(message.guild.id, message.author.id).coins;
      return { options: { bet: parsed === null ? null : Math.min(args.resolveAmount(parsed, wallet), config.economy.maxBet) } };
    },
  },

  async run(ctx) {
    const bet = ctx.opt.integer('bet');
    if (!bet) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/tragamonedas apuesta:` · `-slots 100`'), { ephemeral: true }));
    const outcome = casino.playSlots(ctx.locale, { guildId: ctx.guild.id, userId: ctx.user.id, bet });
    if (outcome.error) return ctx.reply(outcome.error);

    // A short spin before revealing the result.
    const message = await ctx.reply(casino.slotsFrame(ctx.locale, outcome.reels, { spinning: true }));
    await sleep(1200);
    const final = ui.forEdit(casino.slotsFrame(ctx.locale, outcome.reels, outcome));
    if (ctx.isInteraction) return ctx.interaction.editReply(final).catch(() => null);
    return message?.edit(final).catch(() => null);
  },
};

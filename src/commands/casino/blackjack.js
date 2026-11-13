'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const db = require('../../database/db');
const config = require('../../config');
const casino = require('../../features/casino');

const data = loc(new SlashCommandBuilder(), ['blackjack', 'blackjack'], ['Play blackjack against the dealer', 'Juega al blackjack contra el crupier'])
  .addIntegerOption(opt => loc(opt, ['bet', 'apuesta'], ['Coins to bet', 'Monedas que apuestas']).setRequired(true).setMinValue(config.economy.minBet).setMaxValue(config.economy.maxBet));

module.exports = {
  data,
  category: 'casino',
  emoji: 'cards',

  prefix: {
    aliases: ['bj', '21'],
    parse(message, rawArgs) {
      const parsed = args.amount(rawArgs[0] ?? '');
      const wallet = db.member(message.guild.id, message.author.id).coins;
      const bet = parsed === null ? null : Math.min(args.resolveAmount(parsed, wallet), config.economy.maxBet);
      return { options: { bet } };
    },
  },

  async run(ctx) {
    const locale = ctx.locale;
    const bet = ctx.opt.integer('bet');
    if (!bet) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/blackjack apuesta:` · `-bj 500` · `-bj todo`'), { ephemeral: true }));
    if (casino.activeGame(ctx.guild.id, ctx.user.id)) {
      return ctx.reply(ui.message(ui.notice('warn', 'Blackjack', casino.L(locale, 'already')), { ephemeral: true }));
    }
    const taken = casino.takeBet(locale, ctx.guild.id, ctx.user.id, bet);
    if (!taken.ok) return ctx.reply(taken.payload);

    const game = casino.startBlackjack({ guildId: ctx.guild.id, userId: ctx.user.id, name: ctx.displayName, bet });
    const message = await ctx.reply(casino.blackjackMessage(locale, game));
    if (game.inProgress) {
      casino.armTimeout(game, locale, payload => message?.edit({ ...ui.forEdit(payload), attachments: [] }).catch(() => null));
    }
    return message;
  },
};

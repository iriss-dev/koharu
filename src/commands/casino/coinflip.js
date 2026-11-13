'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const db = require('../../database/db');
const config = require('../../config');
const casino = require('../../features/casino');

const data = loc(new SlashCommandBuilder(), ['coinflip', 'moneda'], ['Double or nothing on a coin flip', 'Doble o nada lanzando una moneda'])
  .addIntegerOption(opt => loc(opt, ['bet', 'apuesta'], ['Coins to bet', 'Monedas que apuestas']).setRequired(true).setMinValue(config.economy.minBet).setMaxValue(config.economy.maxBet))
  .addStringOption(opt => loc(opt, ['side', 'lado'], ['Heads or tails', 'Cara o cruz']).setRequired(true).addChoices(choice('heads', 'Heads', 'Cara'), choice('tails', 'Tails', 'Cruz')));

module.exports = {
  data,
  category: 'casino',
  emoji: 'coin',

  prefix: {
    aliases: ['cf', 'flip', 'caraocruz'],
    parse(message, rawArgs) {
      const sideToken = rawArgs.find(a => /^(cara|cruz|heads|tails|h|t)$/i.test(a))?.toLowerCase();
      const side = sideToken ? ({ cara: 'heads', heads: 'heads', h: 'heads' }[sideToken] ?? 'tails') : 'heads';
      const amountToken = rawArgs.find(a => args.amount(a) !== null);
      const wallet = db.member(message.guild.id, message.author.id).coins;
      const parsed = args.amount(amountToken ?? '');
      return { options: { bet: parsed === null ? null : Math.min(args.resolveAmount(parsed, wallet), config.economy.maxBet), side } };
    },
  },

  async run(ctx) {
    const bet = ctx.opt.integer('bet');
    if (!bet) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/moneda apuesta: lado:` · `-cf 200 cara`'), { ephemeral: true }));
    return ctx.reply(casino.coinflip(ctx.locale, { guildId: ctx.guild.id, userId: ctx.user.id, bet, side: ctx.opt.string('side') ?? 'heads' }));
  },
};

'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const help = require('../../features/help');

const data = loc(new SlashCommandBuilder(), ['help', 'ayuda'], ['Everything Koharu can do', 'Todo lo que Koharu puede hacer'])
  .addStringOption(opt => loc(opt, ['command', 'comando'], ['A specific command', 'Un comando en concreto']).setAutocomplete(true).setMaxLength(40));

module.exports = {
  data,
  category: 'general',
  emoji: 'help',
  dm: true,

  prefix: {
    aliases: ['h', 'commands', 'comandos'],
    parse(message, args) {
      return { options: { command: args[0] ?? null } };
    },
  },

  async autocomplete(interaction, locale) {
    return help.commandChoices(locale, interaction.options.getFocused() ?? '');
  },

  async run(ctx) {
    const name = ctx.opt.string('command');
    if (name) {
      const command = help.findCommand(name);
      if (!command) return ctx.reply(ui.message(ui.notice('info', ctx.t('help.homeTitle'), ctx.t('help.notFound', { name })), { ephemeral: true }));
      return ctx.reply(ui.message(help.commandCard(ctx.locale, command, ctx.prefix)));
    }
    return ctx.reply(ui.message(help.homeCard(ctx.locale, ctx.user.id, ctx.prefix, ctx.client.user.displayAvatarURL?.({ size: 256 }))));
  },
};

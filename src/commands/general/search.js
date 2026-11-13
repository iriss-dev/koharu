'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const ui = require('../../core/ui');
const search = require('../../features/search');

const data = loc(new SlashCommandBuilder(), ['search', 'buscar'], ['Search anime, manga, characters, fashion, deals and commands at once', 'Busca anime, manga, personajes, moda, ofertas y comandos a la vez'])
  .addStringOption(opt => loc(opt, ['query', 'consulta'], ['What are you looking for?', '¿Qué buscas?']).setRequired(true).setAutocomplete(true).setMaxLength(100))
  .addStringOption(opt => loc(opt, ['in', 'en'], ['Only search in…', 'Buscar solo en…'])
    .addChoices(
      choice('all', 'Everything', 'Todo'),
      choice('anime', 'Anime', 'Anime'),
      choice('manga', 'Manga', 'Manga'),
      choice('character', 'Characters', 'Personajes'),
      choice('fashion', 'Fashion', 'Moda'),
      choice('deal', 'Game deals', 'Ofertas de juegos'),
      choice('cmd', 'Koharu commands', 'Comandos de Koharu'),
    ));

module.exports = {
  data,
  category: 'general',
  emoji: 'search',
  dm: true,
  cooldown: 3,

  prefix: {
    aliases: ['find', 'busca', 's'],
    parse(message, args) {
      return { options: { query: args.join(' ') } };
    },
  },

  async autocomplete(interaction, locale) {
    return search.suggestions(locale, interaction.options.getFocused(), interaction.options.getString('in') ?? 'all');
  },

  async run(ctx) {
    const query = (ctx.opt.string('query') ?? '').trim();
    if (!query) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/buscar consulta:` · `-buscar frieren`'), { ephemeral: true }));
    await ctx.defer();

    // An autocomplete pick opens its card directly.
    if (search.TOKEN_RE.test(query)) {
      const result = await search.open(ctx.locale, query, { owner: ctx.user.id, prefix: ctx.prefix });
      if (result) return ctx.reply(ui.message(result.card, { files: result.files }));
    }

    const results = await search.run(ctx.locale, query, ctx.opt.string('in') ?? 'all');
    return ctx.reply(ui.message(search.resultsCard(ctx.locale, query, results, ctx.user.id)));
  },
};

'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const { t } = require('../../core/i18n');
const ui = require('../../core/ui');
const anilist = require('../../services/anilist');
const anime = require('../../features/anime');

const genreChoices = anilist.GENRES.map(genre => choice(genre, genre, t('es', `anime.genreNames.${genre}`)));

const data = loc(new SlashCommandBuilder(), ['manga', 'manga'], ['Look up manga and light novels', 'Fichas de manga y novelas ligeras'])
  .addSubcommand(sub => loc(sub, ['search', 'buscar'], ['Look up a manga', 'Busca la ficha de un manga'])
    .addStringOption(opt => loc(opt, ['title', 'título'], ['Manga title', 'Título del manga']).setRequired(true).setAutocomplete(true).setMaxLength(100)))
  .addSubcommand(sub => loc(sub, ['trending', 'tendencias'], ['Trending manga right now', 'Manga en tendencia ahora']))
  .addSubcommand(sub => loc(sub, ['random', 'azar'], ['A random well-rated manga', 'Un manga bien valorado al azar'])
    .addStringOption(opt => loc(opt, ['genre', 'género'], ['Genre', 'Género']).addChoices(...genreChoices)));

module.exports = {
  data,
  category: 'anime',
  emoji: 'book',
  dm: true,
  cooldown: 3,

  prefix: {
    aliases: ['mangas'],
    parse(message, args) {
      const first = args[0]?.toLowerCase();
      if (['tendencias', 'trending', 'top'].includes(first)) return { sub: 'trending' };
      if (['azar', 'random', 'aleatorio'].includes(first)) return { sub: 'random', options: { genre: anilist.GENRES.find(g => g.toLowerCase() === args.slice(1).join(' ').toLowerCase()) ?? null } };
      const rest = (['buscar', 'search'].includes(first) ? args.slice(1) : args).join(' ');
      return { sub: 'search', options: { title: rest } };
    },
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    return focused.name === 'title' ? anime.titleChoices('MANGA', focused.value) : [];
  },

  async run(ctx) {
    const sub = ctx.sub ?? 'search';

    if (sub === 'search') {
      const title = ctx.opt.string('title');
      if (!title) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/manga buscar <título>` · `-manga berserk`'), { ephemeral: true }));
      await ctx.defer();
      const item = await anime.resolveMedia('MANGA', title);
      if (!item) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.noResults', { query: title.replace(/^id:/, '') }))));
      return ctx.reply(ui.message(anime.mediaCard(ctx.locale, item)));
    }

    if (sub === 'trending') {
      await ctx.defer();
      const result = await anilist.browse({ type: 'MANGA', sort: ['TRENDING_DESC', 'POPULARITY_DESC'], perPage: 25 });
      const session = anime.newListSession(ctx.user.id, { title: ctx.t('anime.mangaTrendingTitle'), subtitle: ctx.t('anime.trendingSubtitle'), emoji: 'book', accent: 'rose', items: result.items });
      return ctx.reply(ui.message(anime.listCard(ctx.locale, session, 0)));
    }

    if (sub === 'random') {
      await ctx.defer();
      const genre = ctx.opt.string('genre');
      const item = await anilist.random({ type: 'MANGA', genre: genre ?? undefined });
      if (!item) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.noResults', { query: genre ?? '—' }))));
      return ctx.reply(ui.message(anime.randomCard(ctx.locale, item, ctx.user.id, { type: 'MANGA', genre })));
    }
    return null;
  },
};

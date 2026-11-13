'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const ui = require('../../core/ui');
const anilist = require('../../services/anilist');
const anime = require('../../features/anime');

const SUB_ALIASES = {
  buscar: 'search', search: 'search', ficha: 'search',
  temporada: 'season', season: 'season',
  tendencias: 'trending', trending: 'trending', top: 'trending',
  horario: 'schedule', schedule: 'schedule', emision: 'schedule',
  azar: 'random', aleatorio: 'random', random: 'random', recomienda: 'random',
  similares: 'similar', similar: 'similar', parecidos: 'similar',
};

const genreChoices = anilist.GENRES.map(genre => {
  const es = require('../../core/i18n').t('es', `anime.genreNames.${genre}`);
  return choice(genre, genre, es);
});

const data = loc(new SlashCommandBuilder(), ['anime', 'anime'], ['Look up anime, seasons, schedules and recommendations', 'Fichas de anime, temporadas, horarios y recomendaciones'])
  .addSubcommand(sub => loc(sub, ['search', 'buscar'], ['Look up an anime', 'Busca la ficha de un anime'])
    .addStringOption(opt => loc(opt, ['title', 'título'], ['Anime title', 'Título del anime']).setRequired(true).setAutocomplete(true).setMaxLength(100)))
  .addSubcommand(sub => loc(sub, ['season', 'temporada'], ['Most popular anime of a season', 'Lo más popular de una temporada'])
    .addStringOption(opt => loc(opt, ['season', 'temporada'], ['Season (default: current)', 'Temporada (por defecto, la actual)'])
      .addChoices(choice('WINTER', 'Winter', 'Invierno'), choice('SPRING', 'Spring', 'Primavera'), choice('SUMMER', 'Summer', 'Verano'), choice('FALL', 'Fall', 'Otoño')))
    .addIntegerOption(opt => loc(opt, ['year', 'año'], ['Year (default: current)', 'Año (por defecto, el actual)']).setMinValue(1960).setMaxValue(2100)))
  .addSubcommand(sub => loc(sub, ['trending', 'tendencias'], ['What everyone is watching right now', 'Lo que todo el mundo está viendo ahora']))
  .addSubcommand(sub => loc(sub, ['schedule', 'horario'], ['Upcoming episodes in your timezone', 'Próximos episodios en tu zona horaria'])
    .addStringOption(opt => loc(opt, ['range', 'rango'], ['When', 'Cuándo'])
      .addChoices(choice('day', 'Next 24 hours', 'Próximas 24 horas'), choice('tomorrow', '24–48 hours from now', 'De 24 a 48 horas'), choice('week', 'Next 7 days', 'Próximos 7 días'))))
  .addSubcommand(sub => loc(sub, ['random', 'azar'], ['A random well-rated anime', 'Un anime bien valorado al azar'])
    .addStringOption(opt => loc(opt, ['genre', 'género'], ['Genre', 'Género']).addChoices(...genreChoices)))
  .addSubcommand(sub => loc(sub, ['similar', 'similares'], ['Recommendations based on an anime', 'Recomendaciones a partir de un anime'])
    .addStringOption(opt => loc(opt, ['title', 'título'], ['Anime you liked', 'Anime que te gustó']).setRequired(true).setAutocomplete(true).setMaxLength(100)));

async function fetchSchedule(range) {
  const now = Math.floor(Date.now() / 1000);
  const [from, to] = range === 'tomorrow' ? [now + 86400, now + 2 * 86400] : range === 'week' ? [now, now + 7 * 86400] : [now, now + 86400];
  const entries = [];
  for (let page = 1; page <= (range === 'week' ? 4 : 2); page++) {
    const batch = await anilist.airing(from, to, { page, perPage: 50 });
    entries.push(...batch);
    if (batch.length < 50) break;
  }
  return entries.map(entry => ({ id: entry.media.id, title: anilist.titleOf(entry.media), episode: entry.episode, airingAt: entry.airingAt }));
}

module.exports = {
  data,
  category: 'anime',
  emoji: 'tv',
  dm: true,
  cooldown: 3,

  prefix: {
    aliases: ['ani'],
    parse(message, args) {
      const sub = SUB_ALIASES[args[0]?.toLowerCase()];
      const rest = (sub ? args.slice(1) : args).join(' ').trim();
      if (!sub) return { sub: 'search', options: { title: rest } };
      if (sub === 'random') return { sub, options: { genre: anilist.GENRES.find(g => g.toLowerCase() === rest.toLowerCase()) ?? null } };
      if (sub === 'schedule') return { sub, options: { range: { semana: 'week', week: 'week', mañana: 'tomorrow', manana: 'tomorrow', tomorrow: 'tomorrow' }[rest.toLowerCase()] ?? 'day' } };
      return { sub, options: { title: rest } };
    },
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'title') return [];
    return anime.titleChoices('ANIME', focused.value);
  },

  async run(ctx) {
    const sub = ctx.sub ?? 'search';
    const owner = ctx.user.id;
    const locale = ctx.locale;

    if (sub === 'search' || sub === 'similar') {
      const title = ctx.opt.string('title');
      if (!title) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/anime buscar <título>` · `-anime frieren`'), { ephemeral: true }));
      await ctx.defer();
      const item = await anime.resolveMedia('ANIME', title);
      if (!item) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.noResults', { query: title.replace(/^id:/, '') }))));
      if (sub === 'search') return ctx.reply(ui.message(anime.mediaCard(locale, item)));

      const recs = await anilist.recommendations(item.id);
      if (!recs.length) return ctx.reply(ui.message(ui.notice('info', ctx.t('anime.similar'), ctx.t('anime.recsEmpty'))));
      const session = anime.newListSession(owner, { title: ctx.t('anime.recsTitle', { title: anilist.titleOf(item) }), emoji: 'sparkle', accent: item.coverImage?.color, items: recs });
      return ctx.reply(ui.message(anime.listCard(locale, session, 0)));
    }

    if (sub === 'season' || sub === 'trending') {
      await ctx.defer();
      let title, subtitle, result;
      if (sub === 'season') {
        const current = anilist.currentSeason();
        const season = ctx.opt.string('season') ?? current.season;
        const year = ctx.opt.integer('year') ?? current.year;
        result = await anilist.browse({ season, seasonYear: year, sort: ['POPULARITY_DESC'], perPage: 25 });
        title = ctx.t('anime.seasonTitle', { season: ctx.t(`anime.seasons.${season}`), year });
        subtitle = ctx.t('anime.seasonSubtitle');
      } else {
        result = await anilist.browse({ sort: ['TRENDING_DESC', 'POPULARITY_DESC'], perPage: 25 });
        title = ctx.t('anime.trendingTitle');
        subtitle = ctx.t('anime.trendingSubtitle');
      }
      if (!result.items.length) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.noResults', { query: title }))));
      const session = anime.newListSession(owner, { title, subtitle, emoji: sub === 'season' ? 'calendar' : 'fire', accent: 'lavender', items: result.items });
      return ctx.reply(ui.message(anime.listCard(locale, session, 0)));
    }

    if (sub === 'schedule') {
      await ctx.defer();
      const range = ctx.opt.string('range') ?? 'day';
      const entries = await fetchSchedule(range);
      const session = { owner, range, entries };
      session.id = require('../../core/router').createSession(session);
      return ctx.reply(ui.message(anime.scheduleCard(locale, session, 0)));
    }

    if (sub === 'random') {
      await ctx.defer();
      const genre = ctx.opt.string('genre');
      const item = await anilist.random({ type: 'ANIME', genre: genre ?? undefined });
      if (!item) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.noResults', { query: genre ?? '—' }))));
      return ctx.reply(ui.message(anime.randomCard(locale, item, owner, { type: 'ANIME', genre })));
    }

    return null;
  },
};

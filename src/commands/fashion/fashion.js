'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const ui = require('../../core/ui');
const colors = require('../../utils/colors');
const { fold, truncate } = require('../../utils/text');
const fashion = require('../../features/fashion');

const { OCCASIONS, WEATHER, STYLES, TIP_TOPICS } = fashion.data;

const occasionChoices = Object.entries(OCCASIONS).map(([key, v]) => choice(key, v.en, v.es));
const weatherChoices = Object.entries(WEATHER).map(([key, v]) => choice(key, v.en, v.es));
const styleChoices = Object.entries(STYLES).map(([key, v]) => choice(key, v.name.en, v.name.es));
const topicChoices = Object.entries(TIP_TOPICS).map(([key, v]) => choice(key, v.name.en, v.name.es));

const data = loc(new SlashCommandBuilder(), ['fashion', 'moda'], ['Outfit ideas, style guides, colours and fashion tips', 'Ideas de outfits, guías de estilo, colores y tips de moda'])
  .addSubcommand(sub => loc(sub, ['outfit', 'outfit'], ['Put together an outfit for an occasion', 'Arma un outfit para una ocasión'])
    .addStringOption(opt => loc(opt, ['occasion', 'ocasión'], ['Where are you going?', '¿A dónde vas?']).setRequired(true).addChoices(...occasionChoices))
    .addStringOption(opt => loc(opt, ['weather', 'clima'], ['What is the weather like?', '¿Qué clima hace?']).addChoices(...weatherChoices))
    .addStringOption(opt => loc(opt, ['style', 'estilo'], ['Style (default: one that fits)', 'Estilo (por defecto, uno que encaje)']).addChoices(...styleChoices)))
  .addSubcommand(sub => loc(sub, ['style', 'estilo'], ['Guide to a fashion aesthetic', 'Guía de una estética de moda'])
    .addStringOption(opt => loc(opt, ['name', 'nombre'], ['Style', 'Estilo']).setRequired(true).addChoices(...styleChoices)))
  .addSubcommand(sub => loc(sub, ['colors', 'colores'], ['What goes with a colour', 'Con qué combina un color'])
    .addStringOption(opt => loc(opt, ['color', 'color'], ['Hex code or name, e.g. #F472B6 or sage green', 'Código o nombre, p. ej. #F472B6 o verde salvia']).setRequired(true).setAutocomplete(true).setMaxLength(40)))
  .addSubcommand(sub => loc(sub, ['season', 'colorimetría'], ['Find your colour season', 'Descubre tu colorimetría'])
    .addStringOption(opt => loc(opt, ['undertone', 'subtono'], ['Skin undertone', 'Subtono de piel']).setRequired(true)
      .addChoices(choice('warm', 'Warm (greenish veins, gold suits me)', 'Cálido (venas verdosas, me favorece el oro)'), choice('cool', 'Cool (bluish veins, silver suits me)', 'Frío (venas azuladas, me favorece la plata)'), choice('neutral', 'Neutral / not sure', 'Neutro / no lo sé')))
    .addStringOption(opt => loc(opt, ['hair', 'cabello'], ['Natural hair colour', 'Color natural de cabello']).setRequired(true)
      .addChoices(choice('light', 'Light (blonde, light brown)', 'Claro (rubio, castaño claro)'), choice('medium', 'Medium brown / red', 'Castaño medio / pelirrojo'), choice('dark', 'Dark brown / black', 'Castaño oscuro / negro')))
    .addStringOption(opt => loc(opt, ['eyes', 'ojos'], ['Eye colour', 'Color de ojos']).setRequired(true)
      .addChoices(choice('light', 'Light (blue, green, grey, hazel)', 'Claros (azules, verdes, grises, miel)'), choice('dark', 'Dark (brown, black)', 'Oscuros (café, negros)'))))
  .addSubcommand(sub => loc(sub, ['tip', 'tip'], ['A practical fashion tip', 'Un tip de moda práctico'])
    .addStringOption(opt => loc(opt, ['topic', 'tema'], ['Topic', 'Tema']).addChoices(...topicChoices)));

const SUBS = { outfit: 'outfit', estilo: 'style', style: 'style', colores: 'colors', colors: 'colors', color: 'colors', colorimetria: 'season', colorimetría: 'season', season: 'season', tip: 'tip', tips: 'tip', consejo: 'tip' };

function findKey(table, token) {
  if (!token) return null;
  const key = fold(token);
  for (const [id, value] of Object.entries(table)) {
    const names = [id, value.es, value.en, value.name?.es, value.name?.en].filter(Boolean).map(fold);
    if (names.some(name => name === key || name.split(/[\s/]+/).includes(key))) return id;
  }
  return null;
}

module.exports = {
  data,
  category: 'fashion',
  emoji: 'dress',
  dm: true,
  cooldown: 2,

  prefix: {
    aliases: ['outfit', 'estilo', 'colores', 'look'],
    parse(message, args, alias) {
      const lowered = alias?.toLowerCase();
      let sub = { outfit: 'outfit', look: 'outfit', estilo: 'style', colores: 'colors' }[lowered] ?? SUBS[fold(args[0] ?? '')];
      const rest = ({ outfit: 1, look: 1, estilo: 1, colores: 1 }[lowered] ? args : args.slice(1));
      if (!sub) sub = 'outfit';
      if (sub === 'outfit') {
        return { sub, options: { occasion: rest.map(a => findKey(OCCASIONS, a)).find(Boolean) ?? 'casual', weather: rest.map(a => findKey(WEATHER, a)).find(Boolean), style: rest.map(a => findKey(STYLES, a)).find(Boolean) } };
      }
      if (sub === 'style') return { sub, options: { name: findKey(STYLES, rest.join(' ')) ?? rest.map(a => findKey(STYLES, a)).find(Boolean) } };
      if (sub === 'colors') return { sub, options: { color: rest.join(' ') } };
      if (sub === 'tip') return { sub, options: { topic: findKey(TIP_TOPICS, rest.join(' ')) } };
      return { sub: 'outfit', options: { occasion: 'casual' } };
    },
  },

  async autocomplete(interaction, locale) {
    const focused = fold(interaction.options.getFocused() ?? '');
    const list = colors.colorNames(locale);
    const matches = focused ? list.filter(c => fold(c.name).includes(focused)) : list;
    const out = matches.slice(0, 24).map(c => ({ name: `${c.name} (${c.hex})`, value: c.hex }));
    if (/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(focused)) out.unshift({ name: colors.normalizeHex(focused), value: colors.normalizeHex(focused) });
    return out.slice(0, 25);
  },

  async run(ctx) {
    const sub = ctx.sub ?? 'outfit';
    const locale = ctx.locale;

    if (sub === 'outfit') {
      const occasion = ctx.opt.string('occasion') ?? 'casual';
      const weather = ctx.opt.string('weather') ?? 'mild';
      const style = ctx.opt.string('style');
      const outfit = fashion.generateOutfit({ occasion, weather, style });
      const { card, files } = fashion.outfitMessage(locale, outfit, ctx.user.id);
      return ctx.reply(ui.message(card, { files }));
    }

    if (sub === 'style') {
      const key = ctx.opt.string('name');
      if (!STYLES[key]) {
        const list = Object.values(STYLES).map(s => `\`${ctx.pick(s.name)}\``).join(' · ');
        return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), `\`/moda estilo\` · ${list}`), { ephemeral: true }));
      }
      const { card, files } = fashion.styleMessage(locale, key, ctx.user.id);
      return ctx.reply(ui.message(card, { files }));
    }

    if (sub === 'colors') {
      const input = ctx.opt.string('color');
      const hex = colors.parseColor(input);
      if (!hex) return ctx.reply(ui.message(ui.notice('info', ctx.t('fashion.colorsTitle', { name: truncate(input ?? '—', 40) }), ctx.t('fashion.badColor', { input: truncate(input ?? '', 40) })), { ephemeral: true }));
      const { card, files } = fashion.colorsMessage(locale, hex);
      return ctx.reply(ui.message(card, { files }));
    }

    if (sub === 'season') {
      if (!ctx.opt.string('undertone')) {
        return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/moda colorimetría subtono: cabello: ojos:`'), { ephemeral: true }));
      }
      const result = fashion.colorSeason({ undertone: ctx.opt.string('undertone'), hair: ctx.opt.string('hair'), eyes: ctx.opt.string('eyes') });
      const { card, files } = fashion.seasonMessage(locale, result);
      return ctx.reply(ui.message(card, { files }));
    }

    if (sub === 'tip') {
      return ctx.reply(ui.message(fashion.tipMessage(locale, ctx.opt.string('topic'), ctx.user.id)));
    }
    return null;
  },
};

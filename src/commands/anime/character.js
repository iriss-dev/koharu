'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const anilist = require('../../services/anilist');
const anime = require('../../features/anime');
const { truncate } = require('../../utils/text');

const data = loc(new SlashCommandBuilder(), ['character', 'personaje'], ['Look up an anime or manga character', 'Busca un personaje de anime o manga'])
  .addStringOption(opt => loc(opt, ['name', 'nombre'], ['Character name', 'Nombre del personaje']).setRequired(true).setAutocomplete(true).setMaxLength(100));

module.exports = {
  data,
  category: 'anime',
  emoji: 'star',
  dm: true,
  cooldown: 3,

  prefix: {
    aliases: ['char', 'pj', 'waifu', 'husbando'],
    parse(message, args) {
      return { options: { name: args.join(' ') } };
    },
  },

  async autocomplete(interaction) {
    const query = String(interaction.options.getFocused() ?? '').trim();
    if (!query) return [];
    const list = await anilist.searchCharacters(query, { perPage: 10 });
    return list.map(character => ({
      name: truncate(`${character.name.full}${character.name.native ? ` (${character.name.native})` : ''}`, 100),
      value: `id:${character.id}`,
    }));
  },

  async run(ctx) {
    const name = ctx.opt.string('name');
    if (!name) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/personaje <nombre>` · `-pj frieren`'), { ephemeral: true }));
    await ctx.defer();
    const character = /^id:\d+$/.test(name) ? await anilist.character(name.slice(3)) : await anilist.findCharacter(name);
    if (!character) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.noResults', { query: name.replace(/^id:/, '') }))));
    return ctx.reply(ui.message(anime.characterCard(ctx.locale, character)));
  },
};

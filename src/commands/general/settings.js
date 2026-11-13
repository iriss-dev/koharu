'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const ui = require('../../core/ui');
const { register, t } = require('../../core/i18n');
const db = require('../../database/db');
const config = require('../../config');

register('settings', {
  es: {
    title: 'Configuración del servidor',
    language: 'Idioma',
    languageAuto: 'Automático (el idioma de Discord de cada persona)',
    prefix: 'Prefijo',
    logs: 'Registro de moderación',
    freeGames: 'Canal de juegos gratis',
    rolePanel: 'Panel de roles',
    none: 'sin configurar',
    saved: '{e:check} Guardado.',
    badPrefix: 'El prefijo debe tener entre 1 y 3 caracteres y no puede contener espacios.',
    hint: 'Cambia cada opción con `/config idioma`, `/config prefijo`, `/config registro`, `/ofertas canal` o `/panelroles`.',
  },
  en: {
    title: 'Server settings',
    language: 'Language',
    languageAuto: 'Automatic (each person\'s Discord language)',
    prefix: 'Prefix',
    logs: 'Moderation log',
    freeGames: 'Free games channel',
    rolePanel: 'Role panel',
    none: 'not set',
    saved: '{e:check} Saved.',
    badPrefix: 'The prefix must be 1 to 3 characters with no spaces.',
    hint: 'Change each option with `/settings language`, `/settings prefix`, `/settings logs`, `/deals channel` or `/rolepanel`.',
  },
});

const L = (locale, key, vars) => t(locale, `settings.${key}`, vars);

function settingsCard(locale, guildId) {
  const s = db.guildSettings(guildId);
  const channel = id => (id ? `<#${id}>` : `*${L(locale, 'none')}*`);
  const language = s.language === 'es' ? 'Español' : s.language === 'en' ? 'English' : L(locale, 'languageAuto');
  return ui.card({
    accent: 'lavender',
    emoji: 'gear',
    title: L(locale, 'title'),
    body: [
      'sep',
      [
        ui.bullet('chat', L(locale, 'language'), language),
        ui.bullet('sparkle', L(locale, 'prefix'), `\`${s.prefix || config.prefix}\``),
        ui.bullet('shield', L(locale, 'logs'), channel(s.mod_log_channel_id)),
        ui.bullet('gift', L(locale, 'freeGames'), channel(s.free_games_channel_id)),
        ui.bullet('palette', L(locale, 'rolePanel'), channel(s.role_panel_channel_id)),
      ].join('\n'),
      ui.sub(L(locale, 'hint')),
    ],
  });
}

const data = loc(new SlashCommandBuilder(), ['settings', 'config'], ['Koharu settings for this server', 'Configuración de Koharu en este servidor'])
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => loc(sub, ['view', 'ver'], ['See the current settings', 'Mira la configuración actual']))
  .addSubcommand(sub => loc(sub, ['language', 'idioma'], ['Language Koharu speaks in this server', 'Idioma en el que habla Koharu en este servidor'])
    .addStringOption(opt => loc(opt, ['language', 'idioma'], ['Language', 'Idioma']).setRequired(true)
      .addChoices(choice('auto', 'Automatic (each person\'s Discord language)', 'Automático (el idioma de Discord de cada persona)'), choice('es', 'Español', 'Español'), choice('en', 'English', 'English'))))
  .addSubcommand(sub => loc(sub, ['prefix', 'prefijo'], ['Prefix for text commands', 'Prefijo de los comandos de texto'])
    .addStringOption(opt => loc(opt, ['prefix', 'prefijo'], ['1–3 characters, e.g. - or k!', '1 a 3 caracteres, p. ej. - o k!']).setRequired(true).setMaxLength(3)))
  .addSubcommand(sub => loc(sub, ['logs', 'registro'], ['Channel where moderation actions are logged', 'Canal donde se registran las acciones de moderación'])
    .addChannelOption(opt => loc(opt, ['channel', 'canal'], ['Channel (leave empty to turn off)', 'Canal (vacío para desactivar)']).addChannelTypes(ChannelType.GuildText)));

module.exports = {
  data,
  category: 'config',
  emoji: 'gear',

  async run(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(ui.message(ui.notice('error', L(ctx.locale, 'title'), ctx.t('common.missingPerm', { perm: 'Manage Server' })), { ephemeral: true }));
    }
    const sub = ctx.sub ?? 'view';
    const guildId = ctx.guild.id;

    if (sub === 'language') {
      const value = ctx.opt.string('language');
      db.updateGuildSettings(guildId, { language: value === 'auto' ? null : value });
      // Answer in the newly chosen language.
      const locale = value === 'auto' ? ctx.locale : value;
      return ctx.reply(ui.message(settingsCard(locale, guildId), { ephemeral: true }));
    }
    if (sub === 'prefix') {
      const value = (ctx.opt.string('prefix') ?? '').trim();
      if (!value || value.length > 3 || /\s/.test(value)) return ctx.reply(ui.message(ui.notice('error', L(ctx.locale, 'prefix'), L(ctx.locale, 'badPrefix')), { ephemeral: true }));
      db.updateGuildSettings(guildId, { prefix: value });
    }
    if (sub === 'logs') {
      db.updateGuildSettings(guildId, { mod_log_channel_id: ctx.opt.channel('channel')?.id ?? null });
    }
    return ctx.reply(ui.message(settingsCard(ctx.locale, guildId), { ephemeral: true }));
  },
};

'use strict';

/**
 * Loads every command module under src/commands and indexes it for slash
 * dispatch, prefix aliases (in Spanish and English) and the help / search menus.
 *
 * A command module exports:
 *   data         SlashCommandBuilder (localised with core/slash.loc)
 *   category     key of CATEGORIES
 *   emoji        Koharu emoji name used in menus
 *   run(ctx)     the command, for both slash and prefix
 *   prefix?      { aliases: string[], presets?: { [alias]: { sub?, options? } }, parse?(message, args, alias) }
 *   autocomplete?(interaction, locale)
 *   dm?          true when the command also works in DMs
 *   cooldown?    seconds between uses per user
 */

const fs = require('fs');
const path = require('path');
const { InteractionContextType, ApplicationIntegrationType } = require('discord.js');

const COMMANDS_DIR = path.resolve(__dirname, '../commands');

// Order here is the order of the help menu.
const CATEGORIES = Object.freeze({
  general: { emoji: 'sakura', name: { es: 'General', en: 'General' } },
  anime: { emoji: 'tv', name: { es: 'Anime y manga', en: 'Anime & manga' } },
  social: { emoji: 'hearts', name: { es: 'Interacciones y parejas', en: 'Interactions & couples' } },
  fun: { emoji: 'star', name: { es: 'Diversión', en: 'Fun' } },
  fashion: { emoji: 'dress', name: { es: 'Moda', en: 'Fashion' } },
  deals: { emoji: 'tag', name: { es: 'Ofertas', en: 'Deals' } },
  economy: { emoji: 'coin', name: { es: 'Economía', en: 'Economy' } },
  casino: { emoji: 'cards', name: { es: 'Casino', en: 'Casino' } },
  roles: { emoji: 'palette', name: { es: 'Roles personalizados', en: 'Custom roles' } },
  moderation: { emoji: 'shield', name: { es: 'Moderación', en: 'Moderation' } },
  config: { emoji: 'gear', name: { es: 'Configuración', en: 'Settings' } },
});

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out.sort();
}

function load(dir = COMMANDS_DIR) {
  const commands = new Map();
  const aliases = new Map();
  const slashData = [];

  for (const file of walk(dir)) {
    const command = require(file);
    if (!command.data || typeof command.run !== 'function') {
      throw new Error(`Command at ${file} must export data and run()`);
    }
    const name = command.data.name;
    if (commands.has(name)) throw new Error(`Duplicate command name: ${name}`);
    if (!CATEGORIES[command.category]) throw new Error(`Command ${name} has unknown category "${command.category}"`);

    command.data.setContexts(command.dm
      ? [InteractionContextType.Guild, InteractionContextType.BotDM]
      : [InteractionContextType.Guild]);
    command.data.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);

    commands.set(name, command);
    slashData.push(command.data.toJSON());

    const spanish = command.data.name_localizations?.['es-ES'];
    const names = new Set([name, spanish, ...(command.prefix?.aliases ?? [])].filter(Boolean).map(a => a.toLowerCase()));
    for (const alias of Object.keys(command.prefix?.presets ?? {})) names.add(alias.toLowerCase());

    for (const alias of names) {
      if (aliases.has(alias) && aliases.get(alias).name !== name) {
        throw new Error(`Prefix alias "${alias}" is used by both ${aliases.get(alias).name} and ${name}`);
      }
      aliases.set(alias, { name, preset: command.prefix?.presets?.[alias] ?? null });
    }
  }

  return { commands, aliases, slashData };
}

let loaded = null;

function get() {
  if (!loaded) loaded = load();
  return loaded;
}

/** Localised name of a command, e.g. "ayuda" for Spanish. */
function displayName(command, locale) {
  if (locale === 'es') return command.data.name_localizations?.['es-ES'] ?? command.data.name;
  return command.data.name;
}

function displayDescription(command, locale) {
  if (locale === 'es') return command.data.description_localizations?.['es-ES'] ?? command.data.description;
  return command.data.description;
}

/** Subcommands of a command as { name, description } in the given locale. */
function subcommands(command, locale) {
  const json = command.data.toJSON();
  const out = [];
  const visit = (options, prefix = '') => {
    for (const option of options ?? []) {
      if (option.type === 1) {
        const localName = locale === 'es' ? option.name_localizations?.['es-ES'] ?? option.name : option.name;
        const localDesc = locale === 'es' ? option.description_localizations?.['es-ES'] ?? option.description : option.description;
        out.push({ name: `${prefix}${localName}`, description: localDesc });
      } else if (option.type === 2) {
        const groupName = locale === 'es' ? option.name_localizations?.['es-ES'] ?? option.name : option.name;
        visit(option.options, `${groupName} `);
      }
    }
  };
  visit(json.options);
  return out;
}

module.exports = { CATEGORIES, load, get, displayName, displayDescription, subcommands };

'use strict';

/**
 * Turns Discord events into command runs and component handler calls, with
 * one place for locale resolution, cooldowns, ownership checks and errors.
 */

const { MessageFlags } = require('discord.js');
const config = require('../config');
const db = require('../database/db');
const registry = require('./registry');
const router = require('./router');
const cooldowns = require('./cooldowns');
const ui = require('./ui');
const { t } = require('./i18n');
const { fromInteraction, fromMessage, localeFor } = require('./context');
const { HttpError } = require('./http');
require('./strings');

// Lazy: features load the registry, which loads this file.
const levels = () => require('../features/levels');

function isNetworkError(err) {
  return err instanceof HttpError || ['AbortError', 'TimeoutError'].includes(err?.name) || /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(String(err?.message ?? err?.cause?.message ?? ''));
}

function errorPayload(locale, err) {
  const body = isNetworkError(err) ? t(locale, 'common.apiDown') : t(locale, 'common.errorBody');
  return ui.message(ui.notice('error', t(locale, 'common.errorTitle'), body), { ephemeral: true });
}

async function replyError(interaction, locale, err) {
  const payload = errorPayload(locale, err);
  try {
    if (interaction.deferred && !interaction.replied) {
      // A deferred public reply cannot become ephemeral: edit it instead.
      await interaction.editReply(ui.forEdit(payload));
    } else if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {
    // The interaction may have expired; nothing more to do.
  }
}

function contextFor(source) {
  const settings = source.guild ? db.guildSettings(source.guild.id) : null;
  return {
    settings,
    locale: localeFor(source, settings),
    prefix: settings?.prefix || config.prefix,
  };
}

// Custom IDs from messages posted by Koharu 1.x, so old role panels keep working.
const LEGACY_IDS = { koharu_role_configure: 'kh:roles:configure:*' };

async function handleInteraction(interaction) {
  const { locale, prefix } = contextFor(interaction);
  const { commands } = registry.get();

  if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    let choices = [];
    try {
      choices = (await command?.autocomplete?.(interaction, locale)) ?? [];
    } catch (err) {
      if (!isNetworkError(err)) console.error(`[Autocomplete] /${interaction.commandName}:`, err);
    }
    return interaction.respond(choices.slice(0, 25)).catch(() => null);
  }

  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return null;
    const readyAt = cooldowns.hit(command.data.name, interaction.user.id, command.cooldown);
    if (readyAt) {
      return interaction.reply(ui.message(ui.notice('info', t(locale, 'common.cooldown', { when: `<t:${readyAt}:R>` })), { ephemeral: true })).catch(() => null);
    }
    const ctx = fromInteraction(interaction, locale);
    ctx.prefix = prefix;
    try {
      return await command.run(ctx);
    } catch (err) {
      if (!isNetworkError(err)) console.error(`[Command] /${interaction.commandName}:`, err);
      return replyError(interaction, locale, err);
    }
  }

  if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
    const route = router.decode(LEGACY_IDS[interaction.customId] ?? interaction.customId);
    if (!route) return null;
    const handler = router.handlerFor(route.feature);
    if (!handler) return null;
    if (!router.isOwner(route, interaction.user.id)) {
      return interaction.reply({ content: t(locale, 'common.notYours'), flags: MessageFlags.Ephemeral }).catch(() => null);
    }
    try {
      return await handler(interaction, route, { locale, prefix });
    } catch (err) {
      if (!isNetworkError(err)) console.error(`[Component] ${interaction.customId}:`, err);
      return replyError(interaction, locale, err);
    }
  }
  return null;
}

/** Splits "-abrazo @yuki" into ['abrazo', ['@yuki']] when it starts with a prefix or a mention. */
function splitCommand(content, prefix, botId) {
  const mention = new RegExp(`^<@!?${botId}>\\s*`);
  let body = null;
  let viaMention = false;
  if (content.startsWith(prefix)) body = content.slice(prefix.length);
  else if (mention.test(content)) {
    body = content.replace(mention, '');
    viaMention = true;
  }
  if (body === null) return null;
  const parts = body.trim().split(/\s+/).filter(Boolean);
  return { name: (parts.shift() ?? '').toLowerCase(), args: parts, viaMention };
}

async function handleMessage(message) {
  if (message.author.bot || !message.guild) return null;
  const { locale, prefix } = contextFor(message);
  const split = splitCommand(message.content, prefix, message.client.user.id);
  if (!split) {
    // Ordinary chat earns level XP (never for commands, so spamming them does not pay).
    await levels().onMessage(message, locale).catch(err => console.error('[Levels]', err));
    return null;
  }

  const { commands, aliases } = registry.get();
  // A bare mention opens the help menu; a bare prefix does nothing.
  if (!split.name && !split.viaMention) return null;
  const alias = split.name ? aliases.get(split.name) : { name: 'help', preset: null };
  if (!alias) return null;
  const command = commands.get(alias.name);
  if (!command) return null;

  const readyAt = cooldowns.hit(command.data.name, message.author.id, command.cooldown);
  if (readyAt) return null;

  try {
    const parsed = command.prefix?.parse
      ? await command.prefix.parse(message, split.args, split.name, alias.preset)
      : (alias.preset ?? {});
    const ctx = fromMessage(message, locale, parsed ?? {});
    ctx.prefix = prefix;
    return await command.run(ctx);
  } catch (err) {
    if (!isNetworkError(err)) console.error(`[Prefix] ${prefix}${split.name}:`, err);
    const { flags, ...payload } = errorPayload(locale, err);
    return message.reply({ ...payload, flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false, parse: [] } }).catch(() => null);
  }
}

module.exports = { handleInteraction, handleMessage, splitCommand, isNetworkError, LEGACY_IDS };

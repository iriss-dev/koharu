'use strict';

/**
 * One context object for slash commands and prefix commands, so every command is
 * written once. Prefix commands parse their arguments into the same option names
 * the slash command uses; `ctx.opt.*` reads either source transparently.
 */

const { MessageFlags } = require('discord.js');
const i18n = require('./i18n');
const config = require('../config');

class CommandContext {
  constructor({ interaction = null, message = null, locale, options = {}, sub = null, group = null }) {
    this.interaction = interaction;
    this.message = message;
    this.locale = locale;
    this.isInteraction = Boolean(interaction);
    this.source = interaction ?? message;
    this.client = this.source.client;
    this.guild = this.source.guild;
    this.channel = this.source.channel;
    this.user = interaction ? interaction.user : message.author;
    this.member = this.source.member;
    this._options = options;
    this._sub = sub;
    this._group = group;
    this._replied = null;

    const read = (name, getter) => {
      if (this.interaction) {
        const value = this.interaction.options[getter](name);
        return value ?? null;
      }
      return this._options[name] ?? null;
    };

    this.opt = {
      string: name => read(name, 'getString'),
      integer: name => read(name, 'getInteger'),
      number: name => read(name, 'getNumber'),
      boolean: name => read(name, 'getBoolean'),
      user: name => read(name, 'getUser'),
      member: name => read(name, 'getMember'),
      role: name => read(name, 'getRole'),
      channel: name => read(name, 'getChannel'),
    };
  }

  /** Active subcommand name (English internal name). */
  get sub() {
    if (this.interaction) return this.interaction.options.getSubcommand(false);
    return this._sub;
  }

  get group() {
    if (this.interaction) return this.interaction.options.getSubcommandGroup(false);
    return this._group;
  }

  t(key, vars) {
    return i18n.t(this.locale, key, vars);
  }

  pick(pair) {
    return i18n.pick(this.locale, pair);
  }

  get displayName() {
    return this.member?.displayName ?? this.user.globalName ?? this.user.username;
  }

  /** Defers slash commands; shows "typing…" for prefix commands. */
  async defer({ ephemeral = false } = {}) {
    if (this.interaction) {
      if (!this.interaction.deferred && !this.interaction.replied) {
        await this.interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
      }
    } else {
      await this.channel?.sendTyping?.().catch(() => null);
    }
  }

  /**
   * Sends (or completes) the reply. Ephemeral flags are dropped for prefix commands,
   * where Discord has no private replies.
   */
  async reply(payload) {
    if (this.interaction) {
      const i = this.interaction;
      if (i.deferred && !i.replied) {
        const { flags, ...rest } = payload;
        // The ephemeral bit is fixed at defer time; keep the V2 bit.
        return i.editReply({ ...rest, flags: flags & MessageFlags.IsComponentsV2 ? MessageFlags.IsComponentsV2 : undefined });
      }
      if (i.replied) return i.followUp(payload);
      const response = await i.reply({ ...payload, withResponse: true });
      return response?.resource?.message ?? null;
    }

    const { flags, ...rest } = payload;
    const cleanFlags = flags === undefined ? undefined : flags & ~MessageFlags.Ephemeral;
    return this.message.reply({ ...rest, flags: cleanFlags, allowedMentions: { ...(rest.allowedMentions ?? { parse: [] }), repliedUser: false } });
  }
}

function fromInteraction(interaction, locale) {
  return new CommandContext({ interaction, locale });
}

function fromMessage(message, locale, parsed = {}) {
  return new CommandContext({ message, locale, options: parsed.options ?? {}, sub: parsed.sub ?? null, group: parsed.group ?? null });
}

/** Locale for an interaction or message, honouring the server's chosen language. */
function localeFor(source, guildSettings) {
  return i18n.resolve({
    guildSetting: guildSettings?.language,
    userLocale: source.locale,
    guildLocale: source.guild?.preferredLocale,
    fallback: config.defaultLocale,
  });
}

module.exports = { CommandContext, fromInteraction, fromMessage, localeFor };

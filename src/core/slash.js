'use strict';

/**
 * Helpers for bilingual slash commands.
 *
 * Command and option names are English internally and localised for Spanish
 * Discord clients, so `/help` shows up as `/ayuda` for Spanish speakers:
 *
 *   loc(new SlashCommandBuilder(), ['help', 'ayuda'], ['Show commands', 'Muestra los comandos'])
 */

const { esLocalizations } = require('./i18n');

const NAME_RE = /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u;

function assertName(name) {
  if (!NAME_RE.test(name) || name !== name.toLowerCase()) {
    throw new Error(`Invalid slash command name: "${name}"`);
  }
}

/**
 * @param {*} builder SlashCommandBuilder, subcommand or option builder
 * @param {[string, string]} names [english, spanish]
 * @param {[string, string]} descriptions [english, spanish]
 */
function loc(builder, [en, es], [descEn, descEs]) {
  assertName(en);
  assertName(es);
  builder.setName(en).setDescription(descEn);
  if (es !== en) builder.setNameLocalizations(esLocalizations(es));
  if (descEs && descEs !== descEn) builder.setDescriptionLocalizations(esLocalizations(descEs));
  return builder;
}

/** Choice entry with a Spanish label. */
function choice(value, en, es) {
  const entry = { name: en, value };
  if (es && es !== en) entry.name_localizations = esLocalizations(es);
  return entry;
}

module.exports = { loc, choice };

'use strict';

/**
 * Interactive help: a home card, one page per category (picked from a menu)
 * and a detail card per command, all built from the command registry so they
 * never drift from what the bot actually does.
 */

const ui = require('../../core/ui');
const router = require('../../core/router');
const { register, t, pick } = require('../../core/i18n');
const emojis = require('../../core/emojis');
const { fold, truncate } = require('../../utils/text');

register('help', {
  es: {
    homeTitle: 'Hola, soy Koharu',
    homeIntro: 'Tu compañera para el servidor: anime, moda, ofertas, economía, roles personalizados y moderación, todo con cariño {e:sakura}',
    highlightsTitle: 'Para empezar',
    highlights: [
      '{e:tv} `/anime buscar` · fichas, temporadas y horario de emisión',
      '{e:dress} `/moda outfit` · un outfit completo para tu plan de hoy',
      '{e:gift} `/ofertas gratis` · juegos que están regalando ahora',
      '{e:hearts} `/interactuar` · abrazos, caricias y más con GIFs',
      '{e:search} `/buscar` · encuentra cualquier cosa desde un solo lugar',
    ],
    prefixNote: 'También puedes usar el prefijo `{prefix}` (por ejemplo `{prefix}abrazo @alguien` o `{prefix}anime frieren`).',
    categoryPlaceholder: 'Elige una categoría…',
    commandsIn: '{n} comandos',
    aliases: 'Atajos con prefijo',
    subcommands: 'Opciones',
    home: 'Inicio',
    notFound: 'No conozco el comando «{name}». Abre `/ayuda` para ver la lista.',
    footer: 'Koharu · {count} comandos · los menús son tuyos durante 15 minutos',
  },
  en: {
    homeTitle: 'Hi, I am Koharu',
    homeIntro: 'Your server companion: anime, fashion, deals, economy, custom roles and moderation, all with love {e:sakura}',
    highlightsTitle: 'Get started',
    highlights: [
      '{e:tv} `/anime search` · titles, seasons and airing schedule',
      '{e:dress} `/fashion outfit` · a complete outfit for today\'s plans',
      '{e:gift} `/deals free` · games being given away right now',
      '{e:hearts} `/interact` · hugs, headpats and more with GIFs',
      '{e:search} `/search` · find anything from one place',
    ],
    prefixNote: 'You can also use the `{prefix}` prefix (for example `{prefix}hug @someone` or `{prefix}anime frieren`).',
    categoryPlaceholder: 'Choose a category…',
    commandsIn: '{n} commands',
    aliases: 'Prefix shortcuts',
    subcommands: 'Options',
    home: 'Home',
    notFound: 'I do not know the command “{name}”. Open `/help` to see the list.',
    footer: 'Koharu · {count} commands · menus stay yours for 15 minutes',
  },
});

const L = (locale, key, vars) => t(locale, `help.${key}`, vars);
const registry = () => require('../../core/registry');

function byCategory() {
  const { commands } = registry().get();
  const groups = new Map(Object.keys(registry().CATEGORIES).map(key => [key, []]));
  for (const command of commands.values()) groups.get(command.category).push(command);
  return groups;
}

function categoryMenu(locale, owner, selected = null) {
  const { CATEGORIES } = registry();
  const groups = byCategory();
  return ui.row(ui.select({
    id: router.encode('help', 'cat', owner),
    placeholder: L(locale, 'categoryPlaceholder'),
    options: Object.entries(CATEGORIES)
      .filter(([key]) => groups.get(key).length)
      .map(([key, category]) => ({
        label: pick(locale, category.name),
        value: key,
        emoji: category.emoji,
        description: L(locale, 'commandsIn', { n: groups.get(key).length }),
        default: key === selected,
      })),
  }));
}

function homeCard(locale, owner, prefix, avatarUrl = null) {
  const { commands } = registry().get();
  return ui.card({
    accent: 'primary',
    emoji: 'sakura',
    title: L(locale, 'homeTitle'),
    intro: ui.quote(L(locale, 'homeIntro')),
    thumbnail: avatarUrl ?? emojis.imageUrl('cat') ?? undefined,
    body: [
      'sep',
      `**${L(locale, 'highlightsTitle')}**\n${L(locale, 'highlights').join('\n')}`,
      ui.sub(L(locale, 'prefixNote', { prefix })),
      categoryMenu(locale, owner),
    ],
    footer: L(locale, 'footer', { count: commands.size }),
  });
}

function commandLine(locale, command) {
  const reg = registry();
  const subs = reg.subcommands(command, locale);
  const head = `${emojis.e(command.emoji)} **/${reg.displayName(command, locale)}** · ${reg.displayDescription(command, locale)}`;
  if (!subs.length) return head;
  return `${head}\n${ui.sub(subs.map(sub => `\`${sub.name}\``).join(' · '))}`;
}

function categoryCard(locale, owner, key) {
  const { CATEGORIES } = registry();
  const category = CATEGORIES[key];
  const list = byCategory().get(key) ?? [];
  return ui.card({
    accent: 'lavender',
    emoji: category.emoji,
    title: pick(locale, category.name),
    body: [
      'sep',
      list.map(command => commandLine(locale, command)).join('\n\n'),
      categoryMenu(locale, owner, key),
      ui.row(ui.button({ id: router.encode('help', 'home', owner), label: L(locale, 'home'), emoji: 'sakura' })),
    ],
  });
}

function commandCard(locale, command, prefix) {
  const reg = registry();
  const subs = reg.subcommands(command, locale);
  const aliases = [...new Set([reg.displayName(command, locale), ...(command.prefix?.aliases ?? []), ...Object.keys(command.prefix?.presets ?? {}).slice(0, 12)])];
  const body = ['sep'];
  if (subs.length) body.push(`**${L(locale, 'subcommands')}**\n${subs.map(sub => `\`/${reg.displayName(command, locale)} ${sub.name}\` · ${sub.description}`).join('\n')}`);
  if (command.prefix) body.push(ui.sub(`${L(locale, 'aliases')}: ${aliases.map(alias => `\`${prefix}${alias}\``).join(' ')}`));
  return ui.card({
    accent: 'lavender',
    emoji: command.emoji,
    title: `/${reg.displayName(command, locale)}`,
    intro: ui.quote(reg.displayDescription(command, locale)),
    body,
    footer: pick(locale, reg.CATEGORIES[command.category].name),
  });
}

/** Finds a command by English name, Spanish name or prefix alias. */
function findCommand(name) {
  const { commands, aliases } = registry().get();
  const key = fold(String(name ?? '').replace(/^\//, ''));
  if (commands.has(key)) return commands.get(key);
  const alias = aliases.get(key);
  return alias ? commands.get(alias.name) : null;
}

/** Autocomplete entries for command names in the user's language. */
function commandChoices(locale, query) {
  const reg = registry();
  const q = fold(query);
  return [...reg.get().commands.values()]
    .map(command => ({ command, name: reg.displayName(command, locale) }))
    .filter(({ command, name }) => !q || fold(name).includes(q) || command.data.name.includes(q) || fold(reg.displayDescription(command, locale)).includes(q))
    .slice(0, 25)
    .map(({ command, name }) => ({ name: truncate(`/${name} · ${reg.displayDescription(command, locale)}`, 100), value: command.data.name }));
}

router.register('help', async (interaction, route, { locale, prefix }) => {
  if (route.action === 'cat') {
    return interaction.update(ui.forEdit(ui.message(categoryCard(locale, route.owner, interaction.values[0]))));
  }
  if (route.action === 'home') {
    return interaction.update(ui.forEdit(ui.message(homeCard(locale, route.owner, prefix, interaction.client.user.displayAvatarURL?.({ size: 256 })))));
  }
  return null;
});

module.exports = { homeCard, categoryCard, commandCard, findCommand, commandChoices };

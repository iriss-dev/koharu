'use strict';

/**
 * Koharu's interface kit, built on Discord Components V2.
 *
 * Every reply is a "card": a container with a soft accent colour, a heading with
 * one of Koharu's emojis, quoted body text, optional thumbnail on the right,
 * optional image at the bottom and buttons inside the card. Keeping the layout
 * in one place is what makes forty commands feel like one product.
 */

const path = require('path');
const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder,
  ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, MessageFlags, AttachmentBuilder,
} = require('discord.js');
const emojis = require('./emojis');
const router = require('./router');
const { t } = require('./i18n');
require('./strings'); // shared strings used by every card (pagination, errors…)

const ACCENTS = Object.freeze({
  primary: 0xF472B6,
  rose: 0xEC4899,
  lavender: 0xA78BFA,
  mint: 0x34D399,
  error: 0xF87171,
  gold: 0xFBBF24,
  sky: 0x7DD3FC,
  peach: 0xFDBA74,
});

const ASSETS = path.resolve(__dirname, '../../assets');

function accentValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.startsWith('#')) return Number.parseInt(value.slice(1), 16);
  return ACCENTS[value] ?? ACCENTS.primary;
}

// --------------------------------------------------------------------------- text helpers

const quote = text => String(text).split('\n').map(line => (line.startsWith('> ') ? line : `> ${line}`)).join('\n');
const sub = text => String(text).split('\n').map(line => `-# ${line}`).join('\n');
const bullet = (emoji, label, value) => `${emojis.e(emoji)} **${label}:** ${value}`;
const heading = (emoji, title) => `### ${emoji ? `${emojis.e(emoji)} ` : ''}${title}`;

// --------------------------------------------------------------------------- component helpers

const text = content => new TextDisplayBuilder().setContent(String(content));

function sep({ large = false, divider = true } = {}) {
  return new SeparatorBuilder()
    .setDivider(divider)
    .setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);
}

function thumbnail(url, description) {
  const thumb = new ThumbnailBuilder().setURL(url);
  if (description) thumb.setDescription(String(description).slice(0, 1024));
  return thumb;
}

/**
 * A text block with a thumbnail (or a button) on its right.
 * @param {string|string[]} content up to three text blocks
 */
function section(content, { image, imageAlt, button } = {}) {
  const blocks = (Array.isArray(content) ? content : [content]).filter(Boolean).slice(0, 3);
  const built = new SectionBuilder().addTextDisplayComponents(...blocks.map(text));
  if (button) built.setButtonAccessory(button);
  else if (image) built.setThumbnailAccessory(thumbnail(image, imageAlt));
  return built;
}

function gallery(items) {
  const list = (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, 10);
  return new MediaGalleryBuilder().addItems(
    ...list.map(item => {
      const entry = typeof item === 'string' ? { url: item } : item;
      const built = new MediaGalleryItemBuilder().setURL(entry.url);
      if (entry.description) built.setDescription(String(entry.description).slice(0, 1024));
      if (entry.spoiler) built.setSpoiler(true);
      return built;
    }),
  );
}

const STYLES = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

/**
 * @param {{ id?: string, url?: string, label?: string, emoji?: string, style?: keyof STYLES, disabled?: boolean }} options
 */
function button({ id, url, label, emoji, style = 'secondary', disabled = false }) {
  const built = new ButtonBuilder();
  if (url) built.setStyle(ButtonStyle.Link).setURL(url);
  else built.setStyle(STYLES[style] ?? ButtonStyle.Secondary).setCustomId(id);
  if (label) built.setLabel(String(label).slice(0, 80));
  if (emoji) built.setEmoji(emojis.has(emoji) ? emojis.component(emoji) : { name: emoji });
  if (disabled) built.setDisabled(true);
  return built;
}

/**
 * @param {{ id: string, placeholder?: string, options: Array<{ label: string, value: string, description?: string, emoji?: string, default?: boolean }>, min?: number, max?: number, disabled?: boolean }} options
 */
function select({ id, placeholder, options, min = 1, max = 1, disabled = false }) {
  const built = new StringSelectMenuBuilder().setCustomId(id).setMinValues(min).setMaxValues(Math.min(max, options.length));
  if (placeholder) built.setPlaceholder(String(placeholder).slice(0, 150));
  if (disabled) built.setDisabled(true);
  built.addOptions(
    options.slice(0, 25).map(option => {
      const entry = { label: String(option.label).slice(0, 100), value: String(option.value).slice(0, 100) };
      if (option.description) entry.description = String(option.description).slice(0, 100);
      if (option.emoji) entry.emoji = emojis.has(option.emoji) ? emojis.component(option.emoji) : { name: option.emoji };
      if (option.default) entry.default = true;
      return entry;
    }),
  );
  return built;
}

const row = (...components) => new ActionRowBuilder().addComponents(...components.flat().filter(Boolean));

/**
 * Previous / page indicator / next.
 * @param {{ feature: string, action?: string, owner: string, session: string, page: number, pages: number, locale: string }} options
 */
function pager({ feature, action = 'page', owner, session, page, pages, locale }) {
  return row(
    button({ id: router.encode(feature, action, owner, session, page - 1), emoji: 'arrow_left', disabled: page <= 0 }),
    button({ id: router.encode(feature, 'noop', owner, session, 'i'), label: t(locale, 'common.page', { page: page + 1, pages: Math.max(pages, 1) }), disabled: true }),
    button({ id: router.encode(feature, action, owner, session, page + 1), emoji: 'arrow_right', disabled: page >= pages - 1 }),
  );
}

// --------------------------------------------------------------------------- cards

/**
 * Builds one card.
 * @param {object} options
 * @param {string|number} [options.accent]
 * @param {string} [options.title]
 * @param {string} [options.emoji]
 * @param {string} [options.subtitle] small grey line under the title
 * @param {string} [options.intro] text next to the thumbnail
 * @param {string} [options.thumbnail] image shown at the top right
 * @param {Array<any>} [options.body] strings, 'sep' or component builders
 * @param {string} [options.footer]
 */
function card({ accent = 'primary', title, emoji, subtitle, intro, thumbnail: thumb, thumbnailAlt, body = [], footer } = {}) {
  const container = new ContainerBuilder().setAccentColor(accentValue(accent));

  const head = [title ? heading(emoji, title) : null, subtitle ? sub(subtitle) : null].filter(Boolean).join('\n');
  if (thumb) {
    container.addSectionComponents(section([head, intro].filter(Boolean), { image: thumb, imageAlt: thumbnailAlt || title }));
  } else {
    if (head) container.addTextDisplayComponents(text(head));
    if (intro) container.addTextDisplayComponents(text(intro));
  }

  for (const item of body) add(container, item);

  if (footer) {
    container.addSeparatorComponents(sep({ divider: false }));
    container.addTextDisplayComponents(text(sub(footer)));
  }
  return container;
}

function add(container, item) {
  if (item == null || item === false || item === '') return;
  if (item === 'sep') return container.addSeparatorComponents(sep());
  if (item === 'space') return container.addSeparatorComponents(sep({ divider: false }));
  if (typeof item === 'string') return container.addTextDisplayComponents(text(item));
  if (Array.isArray(item)) return item.forEach(inner => add(container, inner));
  if (item instanceof TextDisplayBuilder) return container.addTextDisplayComponents(item);
  if (item instanceof SeparatorBuilder) return container.addSeparatorComponents(item);
  if (item instanceof SectionBuilder) return container.addSectionComponents(item);
  if (item instanceof MediaGalleryBuilder) return container.addMediaGalleryComponents(item);
  if (item instanceof ActionRowBuilder) return container.addActionRowComponents(item);
  throw new TypeError(`ui.card: unsupported body item ${item?.constructor?.name ?? typeof item}`);
}

/**
 * Turns cards into a message payload.
 * @param {ContainerBuilder|ContainerBuilder[]} cards
 * @param {{ files?: AttachmentBuilder[], ephemeral?: boolean, rows?: ActionRowBuilder[] }} [options]
 */
function message(cards, { files = [], ephemeral = false, rows = [] } = {}) {
  const components = [...(Array.isArray(cards) ? cards : [cards]), ...rows];
  let flags = MessageFlags.IsComponentsV2;
  if (ephemeral) flags |= MessageFlags.Ephemeral;
  return { components, files, flags, allowedMentions: { parse: [] } };
}

/** Payload for editReply/update: those calls only accept the Components V2 flag. */
function forEdit(payload) {
  return { ...payload, flags: payload.flags & MessageFlags.IsComponentsV2 };
}

/** Private "thinking…" state; follow with interaction.editReply(ui.forEdit(...)). */
function deferEphemeral(interaction) {
  return interaction.deferReply({ flags: MessageFlags.Ephemeral });
}

/**
 * Copies a message's components and disables every button/select whose custom ID
 * matches `predicate`, e.g. after a one-time button ("return the hug") was used.
 */
function disableIn(components, predicate) {
  const walk = node => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const copy = { ...node };
    if (copy.custom_id && predicate(copy.custom_id)) copy.disabled = true;
    if (copy.components) copy.components = walk(copy.components);
    if (copy.accessory) copy.accessory = walk(copy.accessory);
    return copy;
  };
  return walk(components.map(component => (typeof component.toJSON === 'function' ? component.toJSON() : component)));
}

/** Short status card: kind is success | error | info | warn. */
function notice(kind, title, description, { footer } = {}) {
  const look = {
    success: { emoji: 'check', accent: 'mint' },
    error: { emoji: 'cross', accent: 'error' },
    info: { emoji: 'info', accent: 'lavender' },
    warn: { emoji: 'warn', accent: 'gold' },
  }[kind] ?? { emoji: 'sakura', accent: 'primary' };
  return card({ accent: look.accent, emoji: look.emoji, title, body: description ? [quote(description)] : [], footer });
}

/** Local image attachment from assets/, referenced as attachment://<name>. */
function asset(file, name = path.basename(file)) {
  return { attachment: new AttachmentBuilder(path.join(ASSETS, file), { name }), url: `attachment://${name}` };
}

function bufferAttachment(buffer, name) {
  return { attachment: new AttachmentBuilder(buffer, { name }), url: `attachment://${name}` };
}

module.exports = {
  ACCENTS, accentValue,
  quote, sub, bullet, heading,
  text, sep, section, thumbnail, gallery, button, select, row, pager,
  card, message, notice, asset, bufferAttachment, forEdit, deferEphemeral, disableIn,
};

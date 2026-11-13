'use strict';

const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const router = require('../../core/router');
const args = require('../../core/args');
const { register, t, pick } = require('../../core/i18n');
const emojis = require('../../core/emojis');
const db = require('../../database/db');
const { cleanUserText, formatNumber } = require('../../utils/text');
const fashionData = require('../../features/fashion/data');
const social = require('../../features/social');
const levels = require('../../features/levels');
const marriage = require('../../features/marriage');
const cards = require('../../features/cards');

register('profile', {
  es: {
    noBio: '*Todavía sin biografía.*',
    wallet: 'Monedero',
    bank: 'Banco',
    rank: 'Puesto',
    rankValue: '#{rank} del servidor',
    streak: 'Racha diaria',
    streakValue: '{n} días',
    role: 'Rol personalizado',
    level: 'Nivel',
    marriedTo: 'En matrimonio con',
    net: 'Monedas',
    style: 'Estilo',
    favorites: 'Anime y manga favoritos',
    noFavorites: 'Marca favoritos con el botón {e:heart} en cualquier ficha de `/anime`.',
    given: 'Lo que más da',
    received: 'Lo que más recibe',
    editBio: 'Editar biografía',
    modalTitle: 'Tu biografía',
    bioLabel: 'Cuéntale al servidor algo de ti',
    bioSaved: '{e:sparkle} ¡Biografía guardada!',
    bioCleared: 'Biografía borrada.',
  },
  en: {
    noBio: '*No bio yet.*',
    wallet: 'Wallet',
    bank: 'Bank',
    rank: 'Rank',
    rankValue: '#{rank} in this server',
    streak: 'Daily streak',
    streakValue: '{n} days',
    role: 'Custom role',
    level: 'Level',
    marriedTo: 'Married to',
    net: 'Coins',
    style: 'Style',
    favorites: 'Favourite anime & manga',
    noFavorites: 'Add favourites with the {e:heart} button on any `/anime` page.',
    given: 'Gives the most',
    received: 'Receives the most',
    editBio: 'Edit bio',
    modalTitle: 'Your bio',
    bioLabel: 'Tell the server something about you',
    bioSaved: '{e:sparkle} Bio saved!',
    bioCleared: 'Bio cleared.',
  },
});

const L = (locale, key, vars) => t(locale, `profile.${key}`, vars);

function topInteraction(locale, list) {
  const first = list?.[0];
  if (!first) return null;
  const def = social.ACTIONS[first.action];
  if (!def) return null;
  return `${def[locale][1]} ×${first.n}`;
}

function profileCard(locale, { user, member, guild, image = null }) {
  const profile = db.profile(user.id);
  const name = member?.displayName ?? user.globalName ?? user.username;
  const lines = [];

  if (guild) {
    const row = db.member(guild.id, user.id);
    lines.push(ui.bullet('coin', L(locale, 'wallet'), `**${formatNumber(locale, row.coins)}**`) + `  ${ui.bullet('piggy', L(locale, 'bank'), `**${formatNumber(locale, row.bank)}**`)}`);
    if (row.coins + row.bank > 0) lines.push(ui.bullet('crown', L(locale, 'rank'), L(locale, 'rankValue', { rank: db.rank(guild.id, user.id) })));
    if (row.daily_streak) lines.push(ui.bullet('fire', L(locale, 'streak'), L(locale, 'streakValue', { n: row.daily_streak })));
    const xp = db.level(guild.id, user.id).xp;
    const info = levels.levelInfo(xp);
    lines.push(ui.bullet('trophy', L(locale, 'level'), `**${info.level}** \`${levels.progressBar(info.current, info.needed, 8)}\``));
    const roleId = db.customRole(guild.id, user.id);
    const role = roleId ? guild.roles.cache.get(roleId) : null;
    if (role) lines.push(ui.bullet('palette', L(locale, 'role'), `${role.toString()} \`${role.hexColor.toUpperCase()}\``));
  }
  const married = marriage.statusLine(locale, user.id);
  if (married) lines.push(married);
  if (profile.style && fashionData.STYLES[profile.style]) {
    const style = fashionData.STYLES[profile.style];
    lines.push(ui.bullet(style.emoji, L(locale, 'style'), pick(locale, style.name)));
  }

  const favorites = db.favorites(user.id).slice(0, 6);
  const favText = favorites.length
    ? favorites.map(f => `${emojis.e(f.media_type === 'MANGA' ? 'book' : 'tv')} [${f.title}](https://anilist.co/${f.media_type === 'MANGA' ? 'manga' : 'anime'}/${f.media_id})`).join('\n')
    : ui.sub(L(locale, 'noFavorites'));

  const body = ['sep', `**${L(locale, 'favorites')}**\n${favText}`];

  if (image) {
    // The picture already shows coins, rank, streak, level and marriage: keep only the extras in text.
    const extras = [];
    const roleId = guild ? db.customRole(guild.id, user.id) : null;
    const role = roleId ? guild.roles.cache.get(roleId) : null;
    if (role) extras.push(ui.bullet('palette', L(locale, 'role'), `${role.toString()} \`${role.hexColor.toUpperCase()}\``));
    if (married) extras.push(married);
    body.unshift(ui.gallery({ url: image.url, description: name }), extras.length ? extras.join('\n') : null);
  }

  if (guild) {
    const stats = db.interactionStats(guild.id, user.id);
    const given = topInteraction(locale, stats.given);
    const received = topInteraction(locale, stats.received);
    if (given || received) {
      body.push(ui.sub([given ? `${L(locale, 'given')}: ${given}` : null, received ? `${L(locale, 'received')}: ${received}` : null].filter(Boolean).join(' · ')));
    }
  }
  body.push(ui.row(ui.button({ id: router.encode('profile', 'bio', user.id), label: L(locale, 'editBio'), emoji: 'ribbon' })));

  return ui.card({
    accent: member?.displayColor || 'primary',
    emoji: 'sakura',
    title: name,
    subtitle: `@${user.username}`,
    intro: [ui.quote(profile.bio ? cleanUserText(profile.bio, 160) : L(locale, 'noBio')), image ? null : lines.join('\n')].filter(Boolean).join('\n\n'),
    thumbnail: image ? undefined : user.displayAvatarURL({ size: 256, extension: 'png' }),
    body,
  });
}

/** The profile banner picture, or null without canvas / outside a server. */
async function profileImage(locale, { user, member, guild }) {
  if (!guild) return null;
  const row = db.member(guild.id, user.id);
  const level = levels.levelInfo(db.level(guild.id, user.id).xp);
  const profile = db.profile(user.id);
  const stats = [
    { label: L(locale, 'net'), value: formatNumber(locale, row.coins + row.bank), color: '#FBBF24' },
    { label: L(locale, 'rank'), value: row.coins + row.bank > 0 ? `#${db.rank(guild.id, user.id)}` : '—', color: '#7DD3FC' },
    { label: L(locale, 'streak'), value: L(locale, 'streakValue', { n: row.daily_streak || 0 }), color: '#F472B6' },
  ];
  const style = profile.style && fashionData.STYLES[profile.style];
  stats.push(style
    ? { label: L(locale, 'style'), value: pick(locale, style.name), color: '#A78BFA' }
    : { label: L(locale, 'favorites'), value: String(db.favorites(user.id).length), color: '#A78BFA' });

  let partner = null;
  const couple = db.partner(user.id);
  if (couple) {
    const partnerMember = await guild.members.fetch(couple.partner_id).catch(() => null);
    const partnerUser = partnerMember?.user ?? await user.client?.users?.fetch?.(couple.partner_id).catch(() => null);
    partner = {
      name: partnerMember?.displayName ?? partnerUser?.globalName ?? partnerUser?.username ?? '…',
      avatar: (partnerMember ?? partnerUser)?.displayAvatarURL?.({ size: 128, extension: 'png', forceStatic: true }) ?? null,
      label: L(locale, 'marriedTo'),
    };
  }
  const buffer = await cards.renderProfile({
    name: member?.displayName ?? user.globalName ?? user.username,
    username: user.username,
    avatar: (member ?? user).displayAvatarURL?.({ size: 256, extension: 'png', forceStatic: true }) ?? null,
    stats,
    level: { level: level.level, current: level.current, needed: level.needed },
    levelLabel: L(locale, 'level'),
    partner,
    accent: member?.displayHexColor,
  }).catch(err => {
    console.error('[Cards] profile:', err.message);
    return null;
  });
  return buffer ? ui.bufferAttachment(buffer, 'profile.png') : null;
}

router.register('profile', async (interaction, route, { locale }) => {
  if (route.action === 'bio') {
    const current = db.profile(interaction.user.id).bio ?? '';
    const input = new TextInputBuilder().setCustomId('bio').setStyle(TextInputStyle.Paragraph).setMaxLength(160).setRequired(false);
    if (current) input.setValue(current);
    const modal = new ModalBuilder()
      .setCustomId(router.encode('profile', 'biomodal', interaction.user.id))
      .setTitle(L(locale, 'modalTitle'))
      .addLabelComponents(new LabelBuilder().setLabel(L(locale, 'bioLabel')).setTextInputComponent(input));
    return interaction.showModal(modal);
  }
  if (route.action === 'biomodal') {
    const bio = interaction.fields.getTextInputValue('bio')?.trim() ?? '';
    db.setBio(interaction.user.id, bio ? bio.slice(0, 160) : null);
    return interaction.reply(ui.message(ui.notice('success', L(locale, 'modalTitle'), bio ? L(locale, 'bioSaved') : L(locale, 'bioCleared')), { ephemeral: true }));
  }
  return null;
});

const data = loc(new SlashCommandBuilder(), ['profile', 'perfil'], ['Your profile: coins, style, favourite anime and more', 'Tu perfil: monedas, estilo, anime favorito y más'])
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Whose profile', 'De quién']));

module.exports = {
  data,
  category: 'general',
  emoji: 'sakura',

  prefix: {
    aliases: ['p', 'me', 'yo'],
    async parse(message, rawArgs) {
      return { options: { user: (await args.user(message, rawArgs[0])) ?? null } };
    },
  },

  async run(ctx) {
    const user = ctx.opt.user('user') ?? ctx.user;
    await ctx.defer();
    const member = ctx.guild ? await ctx.guild.members.fetch(user.id).catch(() => null) : null;
    const image = await profileImage(ctx.locale, { user, member, guild: ctx.guild });
    return ctx.reply(ui.message(profileCard(ctx.locale, { user, member, guild: ctx.guild, image }), { files: image ? [image.attachment] : [] }));
  },

  profileCard,
  profileImage,
};

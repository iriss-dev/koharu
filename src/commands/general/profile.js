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

function profileCard(locale, { user, member, guild }) {
  const profile = db.profile(user.id);
  const name = member?.displayName ?? user.globalName ?? user.username;
  const lines = [];

  if (guild) {
    const row = db.member(guild.id, user.id);
    lines.push(ui.bullet('coin', L(locale, 'wallet'), `**${formatNumber(locale, row.coins)}**`) + `  ${ui.bullet('piggy', L(locale, 'bank'), `**${formatNumber(locale, row.bank)}**`)}`);
    if (row.coins + row.bank > 0) lines.push(ui.bullet('crown', L(locale, 'rank'), L(locale, 'rankValue', { rank: db.rank(guild.id, user.id) })));
    if (row.daily_streak) lines.push(ui.bullet('fire', L(locale, 'streak'), L(locale, 'streakValue', { n: row.daily_streak })));
    const roleId = db.customRole(guild.id, user.id);
    const role = roleId ? guild.roles.cache.get(roleId) : null;
    if (role) lines.push(ui.bullet('palette', L(locale, 'role'), `${role.toString()} \`${role.hexColor.toUpperCase()}\``));
  }
  if (profile.style && fashionData.STYLES[profile.style]) {
    const style = fashionData.STYLES[profile.style];
    lines.push(ui.bullet(style.emoji, L(locale, 'style'), pick(locale, style.name)));
  }

  const favorites = db.favorites(user.id).slice(0, 6);
  const favText = favorites.length
    ? favorites.map(f => `${emojis.e(f.media_type === 'MANGA' ? 'book' : 'tv')} [${f.title}](https://anilist.co/${f.media_type === 'MANGA' ? 'manga' : 'anime'}/${f.media_id})`).join('\n')
    : ui.sub(L(locale, 'noFavorites'));

  const body = ['sep', `**${L(locale, 'favorites')}**\n${favText}`];

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
    intro: [ui.quote(profile.bio ? cleanUserText(profile.bio, 160) : L(locale, 'noBio')), lines.join('\n')].filter(Boolean).join('\n\n'),
    thumbnail: user.displayAvatarURL({ size: 256, extension: 'png' }),
    body,
  });
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
    const member = ctx.guild ? await ctx.guild.members.fetch(user.id).catch(() => null) : null;
    return ctx.reply(ui.message(profileCard(ctx.locale, { user, member, guild: ctx.guild })));
  },

  profileCard,
};

const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const config = require('../config');
const { formatHand, calculateHand } = require('./cards');

const ASSETS_PATH = path.resolve(__dirname, '../../assets');

function getAssetPath(filename) {
  return path.join(ASSETS_PATH, filename);
}

/**
 * Standard cute base embed builder.
 */
function createBaseEmbed(title, description, color = config.colors.primary) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTimestamp();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);

  return embed;
}

function successEmbed(title, description) {
  return createBaseEmbed(
    `🌸 ${title}`,
    description.startsWith('>') ? description : `> ${description.replace(/\n/g, '\n> ')}`,
    config.colors.success
  );
}

function errorEmbed(title, description) {
  return createBaseEmbed(
    `💔 ${title}`,
    description.startsWith('>') ? description : `> ${description.replace(/\n/g, '\n> ')}`,
    config.colors.error
  );
}

/**
 * Builds the interactive Custom Role Panel in Nekotina style.
 * Includes banner.png at the bottom.
 */
function buildRolePanel(settings) {
  const bannerFile = new AttachmentBuilder(getAssetPath('banner.png'), { name: 'banner.png' });

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setAuthor({ name: 'Koharu | Identity & Custom Roles', iconURL: 'https://cdn.discordapp.com/emojis/1049747514330456104.png' })
    .setTitle('🎨 Custom Role Management')
    .setDescription(
      `> Create, customize, and maintain your personal server identity directly from this panel.\n\n` +
      `**✨ Role Features**\n` +
      `• Choose any custom name and 6-character hex color.\n` +
      `• **Server Boosters:** Unlock dual-color gradient roles & free renames.\n` +
      `• Automatic hierarchy positioning beneath staff roles.\n\n` +
      `**🪙 Rates & Pricing**\n` +
      `> • **Coins:** \`${settings.role_cost_coins.toLocaleString()}\` coins\n` +
      `> • **Event Keys:** \`${settings.role_cost_keys}\` 🔑\n` +
      `> • **Server Boosters:** \`${settings.booster_free ? '100% Free ✨' : 'Standard Rate'}\`\n\n` +
      `*Click the button below to open your customization window!*`
    )
    .setImage('attachment://banner.png')
    .setFooter({ text: 'Koharu Role Management • Instant sync & zero clutter' })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('koharu_role_configure')
    .setLabel('Configure Role')
    .setEmoji('🎨')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  return { embed, components: [row], files: [bannerFile] };
}

/**
 * Builds the Blackjack embed in Nekotina style.
 * Cards banner at the bottom.
 */
function buildBlackjackView(game) {
  const pScore = calculateHand(game.playerHand);
  const dScore = calculateHand(game.dealerHand);

  const cardsFile = new AttachmentBuilder(getAssetPath('pink_cards.png'), { name: 'pink_cards.png' });

  const embed = new EmbedBuilder()
    .setColor(game.inProgress ? config.colors.primary : (game.won ? config.colors.success : (game.push ? config.colors.gold : config.colors.error)))
    .setAuthor({ name: `Koharu Casino | Blackjack`, iconURL: 'https://cdn.discordapp.com/emojis/1049747514330456104.png' })
    .setTitle(`🃏 Playing for ${game.bet.toLocaleString()} coins`)
    .setDescription(
      `**Dealer's Hand**\n` +
      `> ${formatHand(game.dealerHand, game.inProgress)} \`(${game.inProgress ? '?' : dScore.total})\`\n\n` +
      `**Your Hand**\n` +
      `> ${formatHand(game.playerHand)} \`(${pScore.total})\`\n\n` +
      `**Game Status:**\n` +
      `> ${game.statusText || 'Choose your move below (`Hit`, `Stand` or `Double Down`).'}`
    )
    .setImage('attachment://pink_cards.png')
    .setFooter({ text: `Player: ${game.username} • Minimum bet: 10 coins` })
    .setTimestamp();

  if (!game.inProgress) {
    return { embed, components: [], files: [cardsFile] };
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_hit_${game.userId}`)
      .setLabel('Hit')
      .setEmoji('🃏')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`bj_stand_${game.userId}`)
      .setLabel('Stand')
      .setEmoji('🛑')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bj_double_${game.userId}`)
      .setLabel('Double Down')
      .setEmoji('⚡')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!game.canDouble)
  );

  return { embed, components: [row], files: [cardsFile] };
}

/**
 * Builds user balance in Nekotina style.
 * Pink yen money stacks image at the bottom.
 */
function buildBalanceEmbed(user, member, roleName = null) {
  const total = user.coins + user.bank;
  const moneyFile = new AttachmentBuilder(getAssetPath('pink_money.jpg'), { name: 'pink_money.jpg' });

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setAuthor({
      name: `${member.displayName}'s Economy & Assets`,
      iconURL: member.user.displayAvatarURL({ dynamic: true })
    })
    .setDescription(
      `> 🪙 **Wallet:** \`${user.coins.toLocaleString()}\` coins\n` +
      `> 🏦 **Bank:** \`${user.bank.toLocaleString()}\` coins\n` +
      `> 💎 **Net Worth:** \`${total.toLocaleString()}\` coins\n` +
      `> 🔑 **Event Keys:** \`${user.keys.toLocaleString()}\` keys\n` +
      `> 🌸 **Custom Role:** ${roleName ? roleName : '*None assigned*'}\n` +
      `> 🚀 **Booster Perk:** ${member.premiumSince ? '`Active Booster ✨`' : '`Standard Member`'}`
    )
    .setImage('attachment://pink_money.jpg')
    .setFooter({ text: 'Koharu Economy System • Safe banking & instant transfers' })
    .setTimestamp();

  return { embed, files: [moneyFile] };
}

/**
 * Builds a rest / cooldown embed in Nekotina style.
 * Yawning cat image at the bottom.
 */
function buildCooldownEmbed(displayName, remainingFormatted) {
  const catFile = new AttachmentBuilder(getAssetPath('cat_yawn.png'), { name: 'cat_yawn.png' });

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setAuthor({ name: 'Koharu | Cozy Jobs & Shifts' })
    .setTitle('☕ Take a Little Rest!')
    .setDescription(
      `> You are still resting from your previous shift, **${displayName}**!\n` +
      `> ⏳ **Time Remaining:** \`${remainingFormatted}\`\n` +
      `> 🐾 Grab some strawberry matcha tea while you wait...`
    )
    .setImage('attachment://cat_yawn.png')
    .setFooter({ text: 'Koharu Jobs • Cooldown protects server economy' })
    .setTimestamp();

  return { embed, files: [catFile] };
}

/**
 * Builds a moderation embed in Nekotina style.
 * Large Yui behind the glass image placed AT THE BOTTOM.
 */
function buildModEmbed(action, targetUser, moderator, reason, duration = null) {
  const yuiFile = new AttachmentBuilder(getAssetPath('yui_glass.png'), { name: 'yui_glass.png' });

  const color = action.includes('Banned')
    ? '#EF4444'
    : action.includes('Timed')
    ? '#EC4899'
    : config.colors.primary;

  const durationLine = duration ? `> ⏳ **Duration:** \`${duration}\`\n` : '';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `Koharu | Moderation Case` })
    .setTitle(`🛡️ Member ${action}`)
    .setDescription(
      `> 👤 **User:** <@${targetUser.id}> \`(${targetUser.id})\`\n` +
      `> 👮 **Moderator:** <@${moderator.id}>\n` +
      `${durationLine}` +
      `> 📝 **Reason:** \`${reason || 'No reason provided'}\``
    )
    .setImage('attachment://yui_glass.png')
    .setFooter({ text: `Koharu Moderation Engine • Case logged successfully` })
    .setTimestamp();

  return { embed, files: [yuiFile] };
}

module.exports = {
  createBaseEmbed,
  successEmbed,
  errorEmbed,
  buildRolePanel,
  buildBlackjackView,
  buildBalanceEmbed,
  buildCooldownEmbed,
  buildModEmbed,
};

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { formatHand, calculateHand } = require('./cards');

/**
 * Creates a cute, styled standard embed.
 * @param {string} title
 * @param {string} description
 * @param {string} color
 * @returns {EmbedBuilder}
 */
function createBaseEmbed(title, description, color = config.colors.primary) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTimestamp();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);

  return embed;
}

/**
 * Creates a standard success embed with cute aesthetic.
 * @param {string} title
 * @param {string} description
 * @returns {EmbedBuilder}
 */
function successEmbed(title, description) {
  return createBaseEmbed(`🌸 ${title}`, description, config.colors.success);
}

/**
 * Creates a clean, helpful error embed.
 * @param {string} title
 * @param {string} description
 * @returns {EmbedBuilder}
 */
function errorEmbed(title, description) {
  return createBaseEmbed(`💔 ${title}`, description, config.colors.error);
}

/**
 * Builds the interactive Role Management Panel embed and action row.
 * @param {object} settings
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function buildRolePanel(settings) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('Custom Role Management')
    .setDescription(
      'Manage your personalized role with our server\'s role features. ' +
      'Create, customize, and maintain your role identity directly from this panel.\n\n' +
      '**✨ Available Features**\n' +
      '• Choose any custom name and 6-character hex color.\n' +
      '• **Nitro Boosters**: Unlock dual-color gradient roles and free renames.\n' +
      '• Automatic hierarchy positioning & persistent assignment.'
    )
    .addFields(
      {
        name: '🪙 Cost per Role',
        value: [
          `• **Coins:** ${settings.role_cost_coins.toLocaleString()} coins`,
          `• **Event Keys:** ${settings.role_cost_keys} 🔑`,
          `• **Server Boosters:** ${settings.booster_free ? '100% Free ✨' : 'Standard rate'}`
        ].join('\n'),
        inline: true
      },
      {
        name: '❓ How it Works',
        value: [
          '1. Click **Configure Role** below.',
          '2. Enter your role name & hex color.',
          '3. Your role is instantly created & synced!'
        ].join('\n'),
        inline: true
      }
    )
    .setFooter({ text: 'Koharu Role Management • Clean & automatic hierarchy' })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('koharu_role_configure')
    .setLabel('Configure Role')
    .setEmoji('🎨')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  return { embed, components: [row] };
}

/**
 * Builds the Blackjack embed and action row buttons.
 * @param {object} game
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function buildBlackjackView(game) {
  const pScore = calculateHand(game.playerHand);
  const dScore = calculateHand(game.dealerHand);

  const embed = new EmbedBuilder()
    .setColor(game.inProgress ? config.colors.primary : (game.won ? config.colors.success : (game.push ? config.colors.gold : config.colors.error)))
    .setTitle(`Blackjack ─ Playing for ${game.bet.toLocaleString()} coins`)
    .setDescription(
      `**Dealer's Hand**\n` +
      `${formatHand(game.dealerHand, game.inProgress)} ` +
      `\`(${game.inProgress ? '?' : dScore.total})\`\n\n` +
      `**Your Hand**\n` +
      `${formatHand(game.playerHand)} \`(${pScore.total})\`\n\n` +
      `**Game Status:** ${game.statusText || 'Choose your next action below.'}`
    )
    .setFooter({ text: `Requested by ${game.username}` })
    .setTimestamp();

  if (!game.inProgress) {
    return { embed, components: [] };
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

  return { embed, components: [row] };
}

/**
 * Builds user balance card.
 * @param {object} user
 * @param {import('discord.js').GuildMember} member
 * @param {string|null} roleName
 * @returns {EmbedBuilder}
 */
function buildBalanceEmbed(user, member, roleName = null) {
  const total = user.coins + user.bank;

  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setAuthor({
      name: `${member.displayName}'s Balance & Assets`,
      iconURL: member.user.displayAvatarURL({ dynamic: true })
    })
    .addFields(
      { name: '🪙 Wallet', value: `${user.coins.toLocaleString()} coins`, inline: true },
      { name: '🏦 Bank', value: `${user.bank.toLocaleString()} coins`, inline: true },
      { name: '💎 Net Worth', value: `${total.toLocaleString()} coins`, inline: true },
      { name: '🔑 Event Keys', value: `${user.keys.toLocaleString()} keys`, inline: true },
      { name: '🌸 Custom Role', value: roleName ? roleName : '*None assigned*', inline: true },
      { name: '🚀 Booster Perk', value: member.premiumSince ? 'Active Booster ✨' : 'Standard Member', inline: true }
    )
    .setFooter({ text: 'Koharu Economy System' })
    .setTimestamp();
}

module.exports = {
  createBaseEmbed,
  successEmbed,
  errorEmbed,
  buildRolePanel,
  buildBlackjackView,
  buildBalanceEmbed,
};

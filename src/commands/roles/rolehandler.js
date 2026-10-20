const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const db = require('../../database/db');
const config = require('../../config');
const { isValidHex, normalizeHex, blendColors, getDualColorPreview } = require('../../utils/colors');
const { errorEmbed, successEmbed } = require('../../utils/embeds');

/**
 * Checks whether a guild member qualifies as a booster.
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean}
 */
function isMemberBooster(member) {
  return Boolean(member.premiumSince);
}

/**
 * Displays the role configuration modal when the user clicks [Configure Role].
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleConfigureButton(interaction) {
  const { member, guild, user } = interaction;
  const userData = db.getUser(user.id);
  const settings = db.getGuildSettings(guild.id);
  const isBooster = isMemberBooster(member);

  let existingRole = null;
  if (userData.custom_role_id) {
    existingRole = guild.roles.cache.get(userData.custom_role_id);
  }

  const modal = new ModalBuilder()
    .setCustomId('modal_koharu_custom_role')
    .setTitle(existingRole ? 'Edit Custom Role' : 'Create Custom Role');

  const nameInput = new TextInputBuilder()
    .setCustomId('role_name')
    .setLabel('Role Name')
    .setPlaceholder('e.g. 🌸 Sakura Blossom')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32)
    .setMinLength(1)
    .setRequired(true);

  if (existingRole) {
    nameInput.setValue(existingRole.name);
  }

  const colorPlaceholder = isBooster && settings.booster_dual_color
    ? 'e.g. #F472B6 or #F472B6, #A78BFA (Booster Dual)'
    : 'e.g. #F472B6 (6-character hex code)';

  const colorInput = new TextInputBuilder()
    .setCustomId('role_color')
    .setLabel(isBooster ? 'Hex Color (Dual Gradient Supported)' : 'Hex Color Code')
    .setPlaceholder(colorPlaceholder)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(25)
    .setMinLength(6)
    .setRequired(true);

  if (existingRole) {
    colorInput.setValue(existingRole.hexColor);
  }

  const paymentNotice = isBooster && settings.booster_free
    ? 'FREE (Server Booster Perk ✨)'
    : `Choose: "coins" (${settings.role_cost_coins.toLocaleString()}) or "key" (${settings.role_cost_keys} 🔑)`;

  const paymentInput = new TextInputBuilder()
    .setCustomId('payment_method')
    .setLabel('Payment Method (coins / key)')
    .setPlaceholder(paymentNotice)
    .setValue(isBooster && settings.booster_free ? 'booster' : 'coins')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(15)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(colorInput),
    new ActionRowBuilder().addComponents(paymentInput)
  );

  await interaction.showModal(modal);
}

/**
 * Processes the submitted custom role configuration modal.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleRoleModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const { guild, member, user } = interaction;
  const rawName = interaction.fields.getTextInputValue('role_name').trim();
  const rawColor = interaction.fields.getTextInputValue('role_color').trim();
  const rawPayment = interaction.fields.getTextInputValue('payment_method').trim().toLowerCase();

  const settings = db.getGuildSettings(guild.id);
  const userData = db.getUser(user.id);
  const isBooster = isMemberBooster(member);

  // 1. Bot Permission Check
  const botMember = guild.members.me;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply({
      embeds: [errorEmbed('Bot Missing Permissions', 'I do not have the `Manage Roles` permission in this server.')]
    });
  }

  // 2. Validate Color(s)
  const colorParts = rawColor.split(',').map(s => s.trim()).filter(Boolean);
  let finalHex = '';
  let dualGradientText = null;

  if (colorParts.length === 1) {
    if (!isValidHex(colorParts[0])) {
      return interaction.editReply({
        embeds: [errorEmbed('Invalid Color', `\`${colorParts[0]}\` is not a valid 6-character hex code! Example: \`#F472B6\`.`)]
      });
    }
    finalHex = normalizeHex(colorParts[0]);
  } else if (colorParts.length >= 2) {
    if (!isBooster || !settings.booster_dual_color) {
      return interaction.editReply({
        embeds: [errorEmbed('Booster Perk Required', 'Dual-color gradient roles are reserved for **Nitro Server Boosters** ✨!')]
      });
    }

    if (!isValidHex(colorParts[0]) || !isValidHex(colorParts[1])) {
      return interaction.editReply({
        embeds: [errorEmbed('Invalid Colors', 'Both colors in your dual combination must be valid 6-character hex codes!')]
      });
    }

    const c1 = normalizeHex(colorParts[0]);
    const c2 = normalizeHex(colorParts[1]);
    finalHex = blendColors(c1, c2, 0.5);
    dualGradientText = getDualColorPreview(c1, c2);
  }

  // 3. Payment Processing
  let usedPaymentMethod = 'free';
  const isExistingRole = Boolean(userData.custom_role_id && guild.roles.cache.has(userData.custom_role_id));

  if (isBooster && settings.booster_free) {
    usedPaymentMethod = 'booster_free';
  } else {
    // If user is editing their existing role and there is no surcharge or they must pay
    const method = rawPayment.includes('key') ? 'key' : 'coins';

    if (method === 'key') {
      if (userData.keys < settings.role_cost_keys) {
        return interaction.editReply({
          embeds: [errorEmbed('Insufficient Keys', `You need **${settings.role_cost_keys} Event Key(s)** 🔑. You currently have **${userData.keys}**.`)]
        });
      }
      db.modifyKeys(user.id, -settings.role_cost_keys);
      usedPaymentMethod = `${settings.role_cost_keys} Event Keys`;
    } else {
      if (userData.coins < settings.role_cost_coins) {
        return interaction.editReply({
          embeds: [errorEmbed('Insufficient Coins', `You need **${settings.role_cost_coins.toLocaleString()} coins** 🪙. Your wallet has **${userData.coins.toLocaleString()}**.`)]
        });
      }
      db.addCoins(user.id, -settings.role_cost_coins);
      usedPaymentMethod = `${settings.role_cost_coins.toLocaleString()} coins`;
    }
  }

  // 4. Role Creation or Update
  try {
    let targetRole = null;

    if (isExistingRole) {
      targetRole = guild.roles.cache.get(userData.custom_role_id);
      await targetRole.setName(rawName);
      await targetRole.setColor(finalHex);
    } else {
      targetRole = await guild.roles.create({
        name: rawName,
        color: finalHex,
        permissions: [],
        reason: `Koharu Custom Role for ${user.tag} (${user.id})`,
      });

      // Calculate safe position beneath anchor role or bot role
      let targetPosition = 1;
      if (settings.anchor_role_id) {
        const anchor = guild.roles.cache.get(settings.anchor_role_id);
        if (anchor && anchor.position > 1) {
          targetPosition = Math.max(1, anchor.position - 1);
        }
      } else {
        const botTop = botMember.roles.highest;
        if (botTop && botTop.position > 1) {
          targetPosition = Math.max(1, botTop.position - 1);
        }
      }

      await targetRole.setPosition(targetPosition).catch(() => null);
      await member.roles.add(targetRole);
      db.setCustomRole(user.id, targetRole.id);
    }

    // Record in database history
    db.recordRolePurchase(user.id, guild.id, targetRole.id, rawName, finalHex, usedPaymentMethod);

    // 5. Build Confirmation Embed
    const confirmEmbed = new EmbedBuilder()
      .setColor(finalHex)
      .setTitle(isExistingRole ? '🌸 Custom Role Updated!' : '🌸 Custom Role Created!')
      .setDescription(
        `Your personalized role **${targetRole.name}** is active and ready!\n\n` +
        `• **Assigned Role:** ${targetRole.toString()}\n` +
        `• **Color Code:** \`${finalHex}\`${dualGradientText ? `\n• **Gradient Blend:** ${dualGradientText}` : ''}\n` +
        `• **Payment:** ${usedPaymentMethod}\n` +
        `• **Booster Status:** ${isBooster ? 'Nitro Booster ✨' : 'Standard Member'}`
      )
      .setFooter({ text: 'Koharu Role Management' })
      .setTimestamp();

    return interaction.editReply({ embeds: [confirmEmbed] });
  } catch (err) {
    console.error('[RoleHandler] Error creating/updating custom role:', err);
    return interaction.editReply({
      embeds: [errorEmbed('Role Operation Failed', `An unexpected error occurred: ${err.message}`)]
    });
  }
}

module.exports = {
  handleConfigureButton,
  handleRoleModalSubmit,
  isMemberBooster,
};

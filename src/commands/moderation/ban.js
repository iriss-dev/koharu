const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildModEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Permanently ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Target member to ban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('delete_days')
        .setDescription('Days of message history to delete (0 to 7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  aliases: ['b'],

  async executeSlash(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason specified';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    const { guild, member: modMember } = interaction;

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Action Denied', 'You cannot ban yourself!')], ephemeral: true });
    }

    if (targetUser.id === guild.ownerId) {
      return interaction.reply({ embeds: [errorEmbed('Action Denied', 'You cannot ban the server owner!')], ephemeral: true });
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    if (targetMember) {
      if (!targetMember.bannable) {
        return interaction.reply({
          embeds: [errorEmbed('Hierarchy Error', 'I cannot ban this user because their role is equal to or higher than mine!')],
          ephemeral: true,
        });
      }

      if (modMember.roles.highest.position <= targetMember.roles.highest.position && modMember.id !== guild.ownerId) {
        return interaction.reply({
          embeds: [errorEmbed('Hierarchy Error', 'You cannot ban someone with an equal or higher role than you!')],
          ephemeral: true,
        });
      }

      // Try sending a DM
      await targetUser.send(`🌸 You were banned from **${guild.name}**.\n**Reason:** ${reason}`).catch(() => null);
    }

    await guild.members.ban(targetUser.id, {
      reason: `${reason} (Banned by ${interaction.user.tag})`,
      deleteMessageSeconds: deleteDays * 24 * 60 * 60,
    });

    const modView = buildModEmbed('Banned', targetUser, interaction.user, reason);
    return interaction.reply({ embeds: [modView.embed], files: modView.files });
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need `Ban Members` permission to use this command.')] });
    }

    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!targetUser) {
      return message.reply({ embeds: [errorEmbed('Usage', '`-ban <@user|ID> [reason]`')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason specified';
    const { guild, member: modMember } = message;

    if (targetUser.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Action Denied', 'You cannot ban yourself!')] });
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      if (!targetMember.bannable) {
        return message.reply({ embeds: [errorEmbed('Hierarchy Error', 'I cannot ban this user because their role is higher than mine.')] });
      }
      if (modMember.roles.highest.position <= targetMember.roles.highest.position && modMember.id !== guild.ownerId) {
        return message.reply({ embeds: [errorEmbed('Hierarchy Error', 'You cannot ban someone with an equal or higher role.')] });
      }
      await targetUser.send(`🌸 You were banned from **${guild.name}**.\n**Reason:** ${reason}`).catch(() => null);
    }

    await guild.members.ban(targetUser.id, { reason: `${reason} (Banned by ${message.author.tag})` });
    const modView = buildModEmbed('Banned', targetUser, message.author, reason);
    return message.reply({ embeds: [modView.embed], files: modView.files });
  },
};

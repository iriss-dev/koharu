const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildModEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Target member to kick')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)
    ),

  aliases: ['k'],

  async executeSlash(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason specified';
    const { guild, member: modMember } = interaction;

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Action Denied', 'You cannot kick yourself!')], ephemeral: true });
    }

    if (targetUser.id === guild.ownerId) {
      return interaction.reply({ embeds: [errorEmbed('Action Denied', 'You cannot kick the server owner!')], ephemeral: true });
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('User Not Found', 'This user is not in the server.')], ephemeral: true });
    }

    if (!targetMember.kickable) {
      return interaction.reply({
        embeds: [errorEmbed('Hierarchy Error', 'I cannot kick this member because their role is equal to or higher than mine!')],
        ephemeral: true,
      });
    }

    if (modMember.roles.highest.position <= targetMember.roles.highest.position && modMember.id !== guild.ownerId) {
      return interaction.reply({
        embeds: [errorEmbed('Hierarchy Error', 'You cannot kick someone with an equal or higher role than you!')],
        ephemeral: true,
      });
    }

    await targetUser.send(`🌸 You were kicked from **${guild.name}**.\n**Reason:** ${reason}`).catch(() => null);
    await targetMember.kick(`${reason} (Kicked by ${interaction.user.tag})`);

    const modView = buildModEmbed('Kicked', targetUser, interaction.user, reason);
    return interaction.reply({ embeds: [modView.embed], files: modView.files });
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need `Kick Members` permission to use this command.')] });
    }

    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!targetUser) {
      return message.reply({ embeds: [errorEmbed('Usage', '`-kick <@user|ID> [reason]`')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason specified';
    const { guild, member: modMember } = message;

    if (targetUser.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Action Denied', 'You cannot kick yourself!')] });
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return message.reply({ embeds: [errorEmbed('User Not Found', 'This member is not in the server.')] });
    }

    if (!targetMember.kickable) {
      return message.reply({ embeds: [errorEmbed('Hierarchy Error', 'I cannot kick this member due to role hierarchy.')] });
    }

    if (modMember.roles.highest.position <= targetMember.roles.highest.position && modMember.id !== guild.ownerId) {
      return message.reply({ embeds: [errorEmbed('Hierarchy Error', 'You cannot kick someone with an equal or higher role.')] });
    }

    await targetUser.send(`🌸 You were kicked from **${guild.name}**.\n**Reason:** ${reason}`).catch(() => null);
    await targetMember.kick(`${reason} (Kicked by ${message.author.tag})`);

    const modView = buildModEmbed('Kicked', targetUser, message.author, reason);
    return message.reply({ embeds: [modView.embed], files: modView.files });
  },
};

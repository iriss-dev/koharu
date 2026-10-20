const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove timeout isolation from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Target member to unmute')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for removing timeout')
        .setRequired(false)
    ),

  aliases: ['unmute', 'unto'],

  async executeSlash(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Timeout removed by moderator';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('User Not Found', 'Member not found.')], ephemeral: true });
    }

    if (!targetMember.isCommunicationDisabled()) {
      return interaction.reply({ embeds: [errorEmbed('Not Timed Out', 'This member does not have an active timeout.')], ephemeral: true });
    }

    await targetMember.timeout(null, `${reason} (Removed by ${interaction.user.tag})`);
    return interaction.reply({
      embeds: [successEmbed('Timeout Removed', `Removed timeout for <@${targetUser.id}>.\n**Reason:** ${reason}`)],
    });
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need `Moderate Members` permission.')] });
    }

    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!targetUser) {
      return message.reply({ embeds: [errorEmbed('Usage', '`-untimeout <@user>`')] });
    }

    const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember || !targetMember.isCommunicationDisabled()) {
      return message.reply({ embeds: [errorEmbed('Not Timed Out', 'This member does not have an active timeout.')] });
    }

    const reason = args.slice(1).join(' ') || 'Timeout removed by moderator';
    await targetMember.timeout(null, `${reason} (Removed by ${message.author.tag})`);

    return message.reply({
      embeds: [successEmbed('Timeout Removed', `Removed timeout for <@${targetUser.id}>.`)],
    });
  },
};

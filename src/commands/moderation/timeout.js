const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { parseDuration, formatDuration } = require('../../utils/duration');
const { buildModEmbed, errorEmbed } = require('../../utils/embeds');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord limit: 28 days

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily isolate a member with a timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Target member to time out')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Duration (e.g. 10m, 1h, 1d, 7d)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false)
    ),

  aliases: ['mute', 'shutup', 'to'],

  async executeSlash(interaction) {
    const targetUser = interaction.options.getUser('user');
    const rawDuration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason specified';

    const ms = parseDuration(rawDuration);
    if (!ms || ms <= 0 || ms > MAX_TIMEOUT_MS) {
      return interaction.reply({
        embeds: [errorEmbed('Invalid Duration', 'Please provide a duration like `10m`, `2h`, `1d` (up to 28 days).')],
        ephemeral: true,
      });
    }

    const { guild, member: modMember } = interaction;
    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Action Denied', 'You cannot time out yourself!')], ephemeral: true });
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('User Not Found', 'Member not found in this server.')], ephemeral: true });
    }

    if (!targetMember.moderatable) {
      return interaction.reply({
        embeds: [errorEmbed('Hierarchy Error', 'I cannot moderate this member because their role is equal to or higher than mine!')],
        ephemeral: true,
      });
    }

    if (modMember.roles.highest.position <= targetMember.roles.highest.position && modMember.id !== guild.ownerId) {
      return interaction.reply({
        embeds: [errorEmbed('Hierarchy Error', 'You cannot moderate someone with an equal or higher role than you!')],
        ephemeral: true,
      });
    }

    const prettyDuration = formatDuration(ms);
    await targetUser.send(`🌸 You have been timed out in **${guild.name}** for **${prettyDuration}**.\n**Reason:** ${reason}`).catch(() => null);
    await targetMember.timeout(ms, `${reason} (Timed out by ${interaction.user.tag})`);

    const modView = buildModEmbed('Timed Out', targetUser, interaction.user, reason, prettyDuration);
    return interaction.reply({ embeds: [modView.embed], files: modView.files });
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need `Moderate Members` permission to use this command.')] });
    }

    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!targetUser || !args[1]) {
      return message.reply({ embeds: [errorEmbed('Usage', '`-timeout <@user> <duration (e.g. 10m, 1h, 1d)> [reason]`')] });
    }

    const ms = parseDuration(args[1]);
    if (!ms || ms <= 0 || ms > MAX_TIMEOUT_MS) {
      return message.reply({ embeds: [errorEmbed('Invalid Duration', 'Duration must be between `10s` and `28d` (e.g. `10m`, `2h`, `1d`).')] });
    }

    const reason = args.slice(2).join(' ') || 'No reason specified';
    const { guild, member: modMember } = message;

    if (targetUser.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Action Denied', 'You cannot time out yourself!')] });
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return message.reply({ embeds: [errorEmbed('User Not Found', 'Member not found in this server.')] });
    }

    if (!targetMember.moderatable) {
      return message.reply({ embeds: [errorEmbed('Hierarchy Error', 'I cannot moderate this member due to role hierarchy.')] });
    }

    if (modMember.roles.highest.position <= targetMember.roles.highest.position && modMember.id !== guild.ownerId) {
      return message.reply({ embeds: [errorEmbed('Hierarchy Error', 'You cannot moderate someone with an equal or higher role.')] });
    }

    const prettyDuration = formatDuration(ms);
    await targetUser.send(`🌸 You have been timed out in **${guild.name}** for **${prettyDuration}**.\n**Reason:** ${reason}`).catch(() => null);
    await targetMember.timeout(ms, `${reason} (Timed out by ${message.author.tag})`);

    const modView = buildModEmbed('Timed Out', targetUser, message.author, reason, prettyDuration);
    return message.reply({ embeds: [modView.embed], files: modView.files });
  },
};

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../config');
const { buildModEmbed, successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue, review, or clear warnings for server members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Issue a warning to a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warning').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View past warnings for a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Clear all warnings for a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    ),

  aliases: ['warning', 'warnings'],

  async executeSlash(interaction) {
    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const reason = interaction.options.getString('reason');

      if (targetUser.id === interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Action Denied', 'You cannot warn yourself!')], ephemeral: true });
      }

      db.addWarning(targetUser.id, guildId, interaction.user.id, reason);
      const totalWarns = db.getWarnings(targetUser.id, guildId).length;

      await targetUser.send(
        `⚠️ You received a warning in **${interaction.guild.name}**.\n**Reason:** ${reason}\n*Total Infractions: ${totalWarns}*`
      ).catch(() => null);

      const modView = buildModEmbed('Warned', targetUser, interaction.user, `${reason} (Total Warnings: ${totalWarns})`);
      return interaction.reply({ embeds: [modView.embed], files: modView.files });
    }

    if (sub === 'list') {
      const warns = db.getWarnings(targetUser.id, guildId);

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`📋 Infraction Record ─ ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Total Warnings: ${warns.length}` })
        .setTimestamp();

      if (warns.length === 0) {
        embed.setDescription('✨ Clean record! This member has no active warnings.');
        return interaction.reply({ embeds: [embed] });
      }

      const lines = warns.map((w, idx) => {
        const date = new Date(w.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `\`#${idx + 1}\` **${w.reason}** ─ by <@${w.moderator_id}> *(${date})*`;
      });

      embed.setDescription(lines.join('\n\n'));
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'clear') {
      db.clearWarnings(targetUser.id, guildId);
      return interaction.reply({
        embeds: [successEmbed('Record Cleared', `Successfully cleared all infractions for <@${targetUser.id}>.`)],
      });
    }
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need `Moderate Members` permission.')] });
    }

    const commandName = message.content.slice(config.prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
    const guildId = message.guild.id;

    if (commandName === 'warnings' || commandName === 'warnlist') {
      const targetUser = message.mentions.users.first() || message.author;
      const warns = db.getWarnings(targetUser.id, guildId);

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`📋 Infraction Record ─ ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Total Warnings: ${warns.length}` })
        .setTimestamp();

      if (warns.length === 0) {
        embed.setDescription('✨ Clean record! This member has no active warnings.');
        return message.reply({ embeds: [embed] });
      }

      const lines = warns.map((w, idx) => {
        const date = new Date(w.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `\`#${idx + 1}\` **${w.reason}** ─ by <@${w.moderator_id}> *(${date})*`;
      });

      embed.setDescription(lines.join('\n\n'));
      return message.reply({ embeds: [embed] });
    }

    if (commandName === 'clearwarns') {
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return message.reply({ embeds: [errorEmbed('Usage', '`-clearwarns <@user>`')] });
      }
      db.clearWarnings(targetUser.id, guildId);
      return message.reply({ embeds: [successEmbed('Record Cleared', `Cleared all infractions for <@${targetUser.id}>.`)] });
    }

    // Default: -warn @user <reason>
    const targetUser = message.mentions.users.first();
    const reason = args.slice(1).join(' ');

    if (!targetUser || !reason) {
      return message.reply({ embeds: [errorEmbed('Usage', '`-warn <@user> <reason>`')] });
    }

    if (targetUser.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Action Denied', 'You cannot warn yourself!')] });
    }

    db.addWarning(targetUser.id, guildId, message.author.id, reason);
    const totalWarns = db.getWarnings(targetUser.id, guildId).length;

    await targetUser.send(
      `⚠️ You received a warning in **${message.guild.name}**.\n**Reason:** ${reason}\n*Total Infractions: ${totalWarns}*`
    ).catch(() => null);

    const modView = buildModEmbed('Warned', targetUser, message.author, `${reason} (Total Warnings: ${totalWarns})`);
    return message.reply({ embeds: [modView.embed], files: modView.files });
  },
};

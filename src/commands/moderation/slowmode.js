const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Adjust chat cooldown per user in the channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(opt =>
      opt.setName('seconds')
        .setDescription('Cooldown in seconds (0 to 21600, 0 to disable)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    ),

  aliases: ['slow'],

  async executeSlash(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.channel;

    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Channel', 'Slowmode can only be applied to text channels.')], ephemeral: true });
    }

    await channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);

    const desc = seconds === 0
      ? 'Slowmode has been **disabled** for this channel.'
      : `Slowmode set to **${seconds} second(s)** per message.`;

    return interaction.reply({ embeds: [successEmbed('Slowmode Updated', desc)] });
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need `Manage Channels` permission.')] });
    }

    const seconds = parseInt(args[0], 10);
    if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
      return message.reply({ embeds: [errorEmbed('Usage', '`-slowmode <seconds (0-21600)>` (0 disables slowmode)')] });
    }

    await message.channel.setRateLimitPerUser(seconds, `Slowmode set by ${message.author.tag}`);

    const desc = seconds === 0
      ? 'Slowmode has been **disabled** for this channel.'
      : `Slowmode set to **${seconds} second(s)** per message.`;

    return message.reply({ embeds: [successEmbed('Slowmode Updated', desc)] });
  },
};

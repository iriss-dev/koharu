const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages from the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (1 to 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Only delete messages from this specific user')
        .setRequired(false)
    ),

  aliases: ['clear', 'clean'],

  async executeSlash(interaction) {
    const amount = interaction.options.getInteger('amount');
    const filterUser = interaction.options.getUser('user');
    const channel = interaction.channel;

    await interaction.deferReply({ ephemeral: true });

    const messages = await channel.messages.fetch({ limit: amount });
    const toDelete = filterUser
      ? messages.filter(m => m.author.id === filterUser.id)
      : messages;

    const deleted = await channel.bulkDelete(toDelete, true).catch(err => {
      console.error('[Purge] Bulk delete error:', err);
      return null;
    });

    if (!deleted) {
      return interaction.editReply({
        embeds: [errorEmbed('Purge Failed', 'Could not delete messages. Note: Discord prevents deleting messages older than 14 days.')]
      });
    }

    const filterText = filterUser ? ` from <@${filterUser.id}>` : '';
    return interaction.editReply({
      embeds: [successEmbed('Messages Purged', `Successfully cleared **${deleted.size} message(s)**${filterText}!`)],
    });
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need `Manage Messages` permission.')] });
    }

    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply({ embeds: [errorEmbed('Usage', '`-purge <amount (1-100)> [@user]`')] });
    }

    const filterUser = message.mentions.users.first();
    const channel = message.channel;

    // Delete invoking command message first
    await message.delete().catch(() => null);

    const messages = await channel.messages.fetch({ limit: amount });
    const toDelete = filterUser
      ? messages.filter(m => m.author.id === filterUser.id)
      : messages;

    const deleted = await channel.bulkDelete(toDelete, true).catch(() => null);
    if (!deleted) {
      return message.channel.send({
        embeds: [errorEmbed('Purge Failed', 'Messages older than 14 days cannot be bulk deleted.')]
      }).then(msg => setTimeout(() => msg.delete().catch(() => null), 4000));
    }

    const filterText = filterUser ? ` from <@${filterUser.id}>` : '';
    const confirmation = await message.channel.send({
      embeds: [successEmbed('Chat Cleaned', `Deleted **${deleted.size} message(s)**${filterText}!`)]
    });

    setTimeout(() => confirmation.delete().catch(() => null), 4000);
  },
};

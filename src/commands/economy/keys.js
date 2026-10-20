const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('keys')
    .setDescription('Manage administrative Event Keys (🔑) for special roles and perks')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('grant')
        .setDescription('Grant Event Keys to a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Number of keys to grant').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('revoke')
        .setDescription('Revoke Event Keys from a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Number of keys to revoke').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('Check how many Event Keys a member holds')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    ),

  aliases: ['key', 'eventkeys'],

  async executeSlash(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');

    if (sub === 'grant') {
      const amount = interaction.options.getInteger('amount');
      const updated = db.modifyKeys(target.id, amount);
      return interaction.reply({
        embeds: [successEmbed('Keys Granted', `Awarded **+${amount} Event Key(s)** 🔑 to <@${target.id}>.\nTotal balance: **${updated.keys} keys**.`)]
      });
    }

    if (sub === 'revoke') {
      const amount = interaction.options.getInteger('amount');
      const current = db.getUser(target.id);
      const toRemove = Math.min(amount, current.keys);
      const updated = db.modifyKeys(target.id, -toRemove);
      return interaction.reply({
        embeds: [successEmbed('Keys Revoked', `Deducted **${toRemove} Event Key(s)** 🔑 from <@${target.id}>.\nRemaining balance: **${updated.keys} keys**.`)]
      });
    }

    if (sub === 'check') {
      const current = db.getUser(target.id);
      return interaction.reply({
        embeds: [successEmbed('Key Balance', `<@${target.id}> currently holds **${current.keys} Event Key(s)** 🔑.`)]
      });
    }
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need `Manage Server` permissions to use this command.')] });
    }

    const action = args[0]?.toLowerCase();
    const target = message.mentions.users.first();
    const amount = parseInt(args[2], 10);

    if (!action || !target || (action !== 'check' && (isNaN(amount) || amount <= 0))) {
      return message.reply({
        embeds: [errorEmbed('Usage', '`-keys grant <@user> <amount>`\n`-keys revoke <@user> <amount>`\n`-keys check <@user>`')]
      });
    }

    if (action === 'grant') {
      const updated = db.modifyKeys(target.id, amount);
      return message.reply({
        embeds: [successEmbed('Keys Granted', `Awarded **+${amount} Event Key(s)** 🔑 to <@${target.id}>.\nTotal balance: **${updated.keys} keys**.`)]
      });
    }

    if (action === 'revoke') {
      const current = db.getUser(target.id);
      const toRemove = Math.min(amount, current.keys);
      const updated = db.modifyKeys(target.id, -toRemove);
      return message.reply({
        embeds: [successEmbed('Keys Revoked', `Deducted **${toRemove} Event Key(s)** 🔑 from <@${target.id}>.\nRemaining balance: **${updated.keys} keys**.`)]
      });
    }

    if (action === 'check') {
      const current = db.getUser(target.id);
      return message.reply({
        embeds: [successEmbed('Key Balance', `<@${target.id}> currently holds **${current.keys} Event Key(s)** 🔑.`)]
      });
    }
  }
};

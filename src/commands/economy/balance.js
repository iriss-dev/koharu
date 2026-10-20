const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
const { buildBalanceEmbed } = require('../../utils/embeds');

async function showBalance(targetMember, guild) {
  const user = db.getUser(targetMember.id);
  let roleDisplay = null;

  if (user.custom_role_id) {
    const role = guild.roles.cache.get(user.custom_role_id);
    if (role) {
      roleDisplay = `${role.toString()} (\`${role.hexColor}\`)`;
    }
  }

  return buildBalanceEmbed(user, targetMember, roleDisplay);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your coin balance, bank savings, and event keys')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Target member to inspect')
        .setRequired(false)
    ),

  aliases: ['bal', 'b', 'money'],

  async executeSlash(interaction) {
    const target = interaction.options.getMember('user') || interaction.member;
    const embed = await showBalance(target, interaction.guild);
    return interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    let target = message.member;
    if (message.mentions.members.first()) {
      target = message.mentions.members.first();
    } else if (args[0]) {
      const match = await message.guild.members.fetch(args[0]).catch(() => null);
      if (match) target = match;
    }

    const embed = await showBalance(target, message.guild);
    return message.reply({ embeds: [embed] });
  },
};

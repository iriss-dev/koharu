const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../config');

const MEDALS = ['🥇', '🥈', '🥉'];

async function buildLeaderboardEmbed(guild) {
  const topUsers = db.getLeaderboard(10);

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('✨ Server Wealth Leaderboard')
    .setDescription('Ranking the wealthiest members across wallet & bank assets.')
    .setTimestamp();

  if (topUsers.length === 0) {
    embed.setDescription('No user economic records found yet! Start working with `-work`.');
    return embed;
  }

  const lines = await Promise.all(
    topUsers.map(async (row, index) => {
      const medal = MEDALS[index] || `\`#${index + 1}\``;
      let name = `User ${row.user_id.slice(-4)}`;

      try {
        const member = await guild.members.fetch(row.user_id);
        if (member) name = member.displayName;
      } catch {
        // user may not be cached or left server
      }

      return `${medal} **${name}** ─ **${row.net_worth.toLocaleString()}** coins ` +
        `*(🪙 ${row.coins.toLocaleString()} / 🏦 ${row.bank.toLocaleString()} / 🔑 ${row.keys})*`;
    })
  );

  embed.setDescription(lines.join('\n\n'));
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the server wealth leaderboard'),

  aliases: ['lb', 'top', 'rich'],

  async executeSlash(interaction) {
    const embed = await buildLeaderboardEmbed(interaction.guild);
    return interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message) {
    const embed = await buildLeaderboardEmbed(message.guild);
    return message.reply({ embeds: [embed] });
  },
};

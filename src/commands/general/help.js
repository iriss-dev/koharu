const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore all of Koharu\'s commands, role management, and economy'),

  aliases: ['h', 'commands'],

  async executeSlash(interaction) {
    const embed = buildHelpEmbed(config.prefix);
    return interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message) {
    const embed = buildHelpEmbed(config.prefix);
    return message.reply({ embeds: [embed] });
  },
};

function buildHelpEmbed(p) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('🌸 Koharu (心春) • Command Directory')
    .setDescription(
      'A cute, feature-packed community bot with dynamic custom roles, dual-gradient booster perks, and a complete economy system.\n\n' +
      `*Default prefix is \`${p}\` or use Slash Commands (\`/\`).*`
    )
    .addFields(
      {
        name: '🎨 Custom Roles & Perks',
        value: [
          `• \`/rolepanel setup\` ─ Post the interactive \`[ Configure Role ]\` button panel.`,
          `• \`/rolepanel config\` ─ Configure prices, anchor hierarchy role, and perks.`,
          `• **Booster Perks:** Server Boosters can configure dual-color gradient roles (` + '`#F472B6, #A78BFA`' + `) and bypass creation fees.`,
        ].join('\n')
      },
      {
        name: '🪙 Economy & Jobs',
        value: [
          `• \`${p}work\` (\`/work\`) ─ Work a cute anime part-time job (5 min cooldown).`,
          `• \`${p}balance [@user]\` (\`/balance\`) ─ View wallet coins, bank savings, and keys.`,
          `• \`${p}dep <amount|all>\` (\`/deposit\`) ─ Deposit coins into your secure bank.`,
          `• \`${p}with <amount|all>\` (\`/withdraw\`) ─ Withdraw coins back to your wallet.`,
          `• \`${p}leaderboard\` (\`/leaderboard\`) ─ View the wealthiest members on the server.`,
        ].join('\n')
      },
      {
        name: '🃏 Casino & Games',
        value: [
          `• \`${p}bj <amount>\` (\`/blackjack\`) ─ Play high-stakes interactive Blackjack with **Hit**, **Stand**, and **Double Down** buttons.`,
        ].join('\n')
      },
      {
        name: '🔑 Administration',
        value: [
          `• \`/keys grant <@user> <amount>\` ─ Award Event Keys for winning tournaments or milestones.`,
          `• \`/keys revoke <@user> <amount>\` ─ Revoke Event Keys from a member.`,
          `• \`/keys check <@user>\` ─ Inspect a member's key stash.`,
        ].join('\n')
      }
    )
    .setFooter({ text: 'Koharu • Crafted with care for anime & roleplay communities' })
    .setTimestamp();
}

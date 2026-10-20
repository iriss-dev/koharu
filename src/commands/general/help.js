const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore all of Koharu\'s commands, role management, moderation, and economy'),

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
      'A cute, feature-packed community bot with dynamic custom roles, dual-gradient booster perks, moderation tools, and an economy system.\n\n' +
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
        name: '🛡️ Moderation Tools',
        value: [
          `• \`/ban <user> [reason]\` (\`${p}ban\`) ─ Ban an abusive member.`,
          `• \`/kick <user> [reason]\` (\`${p}kick\`) ─ Kick a member from the server.`,
          `• \`/timeout <user> <duration>\` (\`${p}timeout\`) ─ Isolate member (e.g. \`10m\`, \`1h\`, \`1d\`).`,
          `• \`/untimeout <user>\` (\`${p}untimeout\`) ─ Remove active timeout.`,
          `• \`/purge <amount> [user]\` (\`${p}purge\`) ─ Bulk delete messages (1-100).`,
          `• \`/slowmode <seconds>\` (\`${p}slowmode\`) ─ Set chat rate limit (0 to disable).`,
          `• \`/warn <add|list|clear>\` (\`${p}warn\`) ─ Issue infractions and track records.`,
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
        name: '🔑 Administration & Keys',
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

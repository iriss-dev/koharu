const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../database/db');
const { buildRolePanel, successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolepanel')
    .setDescription('Manage the interactive custom role management panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Deploy the interactive role configuration panel embed')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Target text channel (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('Configure role pricing, anchor position, and booster perks')
        .addIntegerOption(opt =>
          opt.setName('coins_cost')
            .setDescription('Price in server coins to create/edit a custom role')
            .setMinValue(0)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('keys_cost')
            .setDescription('Price in Event Keys to create/edit a custom role')
            .setMinValue(0)
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('booster_free')
            .setDescription('Are server boosters exempt from role costs?')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('booster_dual_color')
            .setDescription('Allow server boosters to use dual-color gradient roles?')
            .setRequired(false)
        )
        .addRoleOption(opt =>
          opt.setName('anchor_role')
            .setDescription('Hierarchy anchor: custom roles will be placed beneath this role')
            .setRequired(false)
        )
    ),

  aliases: ['rpanel'],

  async executeSlash(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const settings = db.getGuildSettings(guildId);
      const panel = buildRolePanel(settings);

      const msg = await channel.send({
        embeds: [panel.embed],
        components: panel.components,
        files: panel.files,
      });
      db.setRolePanel(guildId, channel.id, msg.id);

      return interaction.reply({
        embeds: [successEmbed('Panel Deployed', `Interactive role panel successfully posted in ${channel.toString()}!`)],
        ephemeral: true,
      });
    }

    if (sub === 'config') {
      const current = db.getGuildSettings(guildId);

      const updatedCoins = interaction.options.getInteger('coins_cost') ?? current.role_cost_coins;
      const updatedKeys = interaction.options.getInteger('keys_cost') ?? current.role_cost_keys;
      const updatedBoosterFree = interaction.options.getBoolean('booster_free') ?? Boolean(current.booster_free);
      const updatedDualColor = interaction.options.getBoolean('booster_dual_color') ?? Boolean(current.booster_dual_color);
      const updatedAnchor = interaction.options.getRole('anchor_role')?.id ?? current.anchor_role_id;

      const newSettings = db.saveGuildSettings({
        guild_id: guildId,
        role_cost_coins: updatedCoins,
        role_cost_keys: updatedKeys,
        booster_free: updatedBoosterFree ? 1 : 0,
        booster_dual_color: updatedDualColor ? 1 : 0,
        anchor_role_id: updatedAnchor,
      });

      return interaction.reply({
        embeds: [
          successEmbed(
            'Settings Saved',
            `Custom role system settings have been updated:\n\n` +
            `• **Coin Cost:** ${newSettings.role_cost_coins.toLocaleString()} coins\n` +
            `• **Key Cost:** ${newSettings.role_cost_keys} 🔑\n` +
            `• **Boosters Free:** ${newSettings.booster_free ? 'Yes ✨' : 'No'}\n` +
            `• **Booster Dual Color:** ${newSettings.booster_dual_color ? 'Enabled 🌈' : 'Disabled'}\n` +
            `• **Hierarchy Anchor:** ${newSettings.anchor_role_id ? `<@&${newSettings.anchor_role_id}>` : '*None (top of bot permissions)*'}`
          )
        ],
        ephemeral: true,
      });
    }
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need `Manage Roles` permission to run this command.')] });
    }

    const action = args[0]?.toLowerCase();

    if (action === 'setup') {
      const settings = db.getGuildSettings(message.guild.id);
      const panel = buildRolePanel(settings);
      const msg = await message.channel.send({
        embeds: [panel.embed],
        components: panel.components,
        files: panel.files,
      });
      db.setRolePanel(message.guild.id, message.channel.id, msg.id);
      return message.reply({ embeds: [successEmbed('Panel Deployed', 'Interactive role panel has been published!')] });
    }

    return message.reply({
      embeds: [errorEmbed('Usage', 'Use `-rolepanel setup` or use the slash command `/rolepanel config` to modify parameters.')]
    });
  }
};

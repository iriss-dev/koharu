const { commands } = require('../commands');
const { handleConfigureButton, handleRoleModalSubmit } = require('../commands/roles/rolehandler');
const { getActiveGame, handleHit, handleStand, handleDoubleDown } = require('../commands/economy/blackjack');
const { buildBlackjackView, errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // 1. Slash Command execution
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command || !command.executeSlash) return;

      try {
        await command.executeSlash(interaction);
      } catch (err) {
        console.error(`[Interaction] Error in /${interaction.commandName}:`, err);
        const reply = {
          embeds: [errorEmbed('Command Error', 'An unexpected error occurred while executing this command.')],
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => null);
        } else {
          await interaction.reply(reply).catch(() => null);
        }
      }
      return;
    }

    // 2. Button Interaction Handling
    if (interaction.isButton()) {
      const { customId, user } = interaction;

      // Custom Role Configure Button
      if (customId === 'koharu_role_configure') {
        try {
          await handleConfigureButton(interaction);
        } catch (err) {
          console.error('[Interaction] Error opening role modal:', err);
        }
        return;
      }

      // Blackjack interactive controls
      if (customId.startsWith('bj_')) {
        const parts = customId.split('_');
        const action = parts[1]; // 'hit', 'stand', 'double'
        const ownerId = parts[2];

        // Ensure only the player who started the game can click the buttons
        if (user.id !== ownerId) {
          return interaction.reply({
            content: '🌸 This is not your blackjack game! Start your own with `/blackjack` or `-bj <bet>`.',
            ephemeral: true,
          });
        }

        const game = getActiveGame(ownerId);
        if (!game || !game.inProgress) {
          return interaction.reply({
            content: 'This game has already concluded.',
            ephemeral: true,
          });
        }

        if (action === 'hit') {
          handleHit(game);
        } else if (action === 'stand') {
          handleStand(game);
        } else if (action === 'double') {
          const res = handleDoubleDown(game);
          if (res.error) {
            return interaction.reply({ content: res.error, ephemeral: true });
          }
        }

        const view = buildBlackjackView(game);
        return interaction.update({
          embeds: [view.embed],
          components: view.components,
        });
      }
      return;
    }

    // 3. Modal Submission Handling
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_koharu_custom_role') {
        await handleRoleModalSubmit(interaction);
      }
    }
  },
};

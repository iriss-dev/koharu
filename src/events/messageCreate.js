const config = require('../config');
const { commands, aliases } = require('../commands');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const prefix = config.prefix;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const resolvedName = aliases.get(commandName);
    if (!resolvedName) return;

    const command = commands.get(resolvedName);
    if (!command || !command.executePrefix) return;

    try {
      await command.executePrefix(message, args);
    } catch (err) {
      console.error(`[Message] Error executing ${prefix}${commandName}:`, err);
      await message.reply({
        embeds: [errorEmbed('Command Error', 'An unexpected error occurred while executing this command.')],
      }).catch(() => null);
    }
  },
};

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

const commands = new Collection();
const aliases = new Collection();
const slashCommandData = [];

function loadCommands(dir = __dirname) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'index.js') {
      try {
        const cmd = require(fullPath);
        if (!cmd.data || !cmd.data.name) continue;

        commands.set(cmd.data.name, cmd);
        slashCommandData.push(cmd.data.toJSON());

        // Map primary name for prefix execution
        aliases.set(cmd.data.name.toLowerCase(), cmd.data.name);

        // Map any aliases
        if (Array.isArray(cmd.aliases)) {
          for (const alias of cmd.aliases) {
            aliases.set(alias.toLowerCase(), cmd.data.name);
          }
        }
      } catch (err) {
        console.error(`[Commands] Failed to load command at ${fullPath}:`, err);
      }
    }
  }
}

loadCommands();

module.exports = {
  commands,
  aliases,
  slashCommandData,
};

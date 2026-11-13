'use strict';

const { Events } = require('discord.js');
const { handleInteraction } = require('../core/dispatch');

module.exports = {
  name: Events.InteractionCreate,
  execute: interaction => handleInteraction(interaction),
};

'use strict';

const { Events } = require('discord.js');
const { handleMessage } = require('../core/dispatch');

module.exports = {
  name: Events.MessageCreate,
  execute: message => handleMessage(message),
};

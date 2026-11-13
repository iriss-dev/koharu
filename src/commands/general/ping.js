'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const { pick } = require('../../core/i18n');

const data = loc(new SlashCommandBuilder(), ['ping', 'ping'], ['Check that Koharu is awake', 'Comprueba que Koharu está despierta']);

module.exports = {
  data,
  category: 'general',
  emoji: 'coffee',
  dm: true,

  prefix: { aliases: ['latencia'] },

  async run(ctx) {
    const ws = Math.round(ctx.client.ws.ping);
    const uptime = Math.floor((Date.now() - (ctx.client.readyTimestamp ?? Date.now())) / 1000);
    return ctx.reply(ui.message(ui.card({
      accent: 'mint',
      emoji: 'coffee',
      title: pick(ctx.locale, { es: '¡Aquí estoy!', en: 'I am here!' }),
      body: [ui.quote(`${pick(ctx.locale, { es: 'Latencia', en: 'Latency' })}: **${ws >= 0 ? ws : '…'} ms**\n${pick(ctx.locale, { es: 'Despierta desde', en: 'Awake since' })} <t:${Math.floor(Date.now() / 1000) - uptime}:R>`)],
    })));
  },
};

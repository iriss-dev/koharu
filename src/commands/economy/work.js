const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../config');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

const JOBS = [
  { text: 'Worked a quiet afternoon shift at the cat café serving strawberry matcha lattes', bonus: 0 },
  { text: 'Delivered freshly baked melonpan on a bicycle across town', bonus: 15 },
  { text: 'Helped the shrine maiden sweep cherry blossom petals off the stone stairs', bonus: 30 },
  { text: 'Organized manga shelves and recommended shoujo titles at the local bookstore', bonus: 10 },
  { text: 'Whipped up fluffy souffle pancakes at an anime maid café', bonus: 25 },
  { text: 'Assisted a mangaka by adding screen tones and inking background panels', bonus: 45 },
  { text: 'Fried golden takoyaki at the evening summer matsuri festival booth', bonus: 35 },
  { text: 'Served cute boba milk teas with honey tapioca pearls', bonus: 20 },
  { text: 'Decorated pastel strawberry shortcakes at the neighborhood patisserie', bonus: 25 },
  { text: 'Helped tutor a junior in mathematics at the school library', bonus: 15 },
  { text: 'Tended the rooftop greenhouse garden and watered sweet hydrangeas', bonus: 20 },
  { text: 'Handcrafted cute plushies for the anime convention artist alley', bonus: 40 },
  { text: 'Covered the late-night shift at the 24-hour konbini restocking onigiri', bonus: 30 },
  { text: 'Worked as a chat moderator for a cute cozy VTuber stream', bonus: 50 },
  { text: 'Staged miniature anime dioramas for an upcoming hobby exhibition', bonus: 25 },
];

function formatTimeRemaining(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function executeWork(userId, displayName) {
  const user = db.getUser(userId);
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - (user.last_work || 0);

  if (elapsed < config.economy.workCooldown) {
    const remaining = config.economy.workCooldown - elapsed;
    return {
      success: false,
      embed: errorEmbed(
        'Take a Break!',
        `You are still resting, **${displayName}**! Please wait **${formatTimeRemaining(remaining)}** before working again.`
      ),
    };
  }

  const job = JOBS[Math.floor(Math.random() * JOBS.length)];
  const range = config.economy.workMax - config.economy.workMin;
  const earned = config.economy.workMin + Math.floor(Math.random() * range) + job.bonus;

  db.addCoins(userId, earned);
  db.setLastWork(userId, now);

  const embed = successEmbed(
    'Shift Completed!',
    `**${job.text}**\n\nYou earned **+${earned.toLocaleString()} coins** 🪙!`
  );

  return { success: true, embed };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work a cute part-time job to earn coins'),
  
  aliases: ['job', 'w'],

  async executeSlash(interaction) {
    const res = executeWork(interaction.user.id, interaction.member.displayName);
    return interaction.reply({ embeds: [res.embed], ephemeral: !res.success });
  },

  async executePrefix(message) {
    const res = executeWork(message.author.id, message.member.displayName);
    return message.reply({ embeds: [res.embed] });
  },
};

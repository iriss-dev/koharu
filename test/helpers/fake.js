'use strict';

/**
 * Minimal fakes of discord.js objects: just enough surface to run real commands
 * and component handlers end to end without a network connection.
 */

const { Collection, PermissionFlagsBits } = require('discord.js');

// Realistic snowflakes: mention parsing only accepts real Discord IDs.
const IDS = { iris: '111111111111111111', yuki: '222222222222222222', bot: '999999999999999999' };

function fakeUser(id, name = 'Iris', extra = {}) {
  return {
    id,
    username: name.toLowerCase(),
    globalName: name,
    tag: name,
    bot: false,
    sent: [],
    displayAvatarURL: () => `https://cdn.example.com/avatars/${id}.png`,
    async send(payload) {
      this.sent.push(payload);
      return {};
    },
    toString: () => `<@${id}>`,
    ...extra,
  };
}

function fakeRole(id, { name = 'role', position = 1, color = '#F472B6' } = {}) {
  return {
    id, name, position, hexColor: color.toLowerCase(),
    toString: () => `<@&${id}>`,
    comparePositionTo(other) { return this.position - other.position; },
    async edit(opts) { Object.assign(this, { name: opts.name ?? this.name }); this.lastEdit = opts; return this; },
    async setPosition(position) { this.position = position; return this; },
  };
}

function permissionsOf(list) {
  const set = new Set(list.map(String));
  return { has: perm => (Array.isArray(perm) ? perm.every(p => set.has(String(p))) : set.has(String(perm))) || set.has(String(PermissionFlagsBits.Administrator)) };
}

function fakeGuild({ id = 'g1', ownerId = 'owner', features = [] } = {}) {
  const roles = new Collection();
  const members = new Collection();
  const channels = new Collection();
  let roleSeq = 100;
  const guild = {
    id, name: 'Koharu Café', ownerId, features, preferredLocale: 'es-ES',
    roles: {
      cache: roles,
      async create(opts) {
        const role = fakeRole(String(roleSeq++), { name: opts.name, position: 2 });
        role.created = opts;
        roles.set(role.id, role);
        return role;
      },
    },
    members: {
      cache: members,
      me: null,
      async fetch(arg) {
        if (typeof arg === 'string') {
          const found = members.get(arg);
          if (!found) throw new Error('Unknown Member');
          return found;
        }
        if (arg?.user) return new Collection(arg.user.filter(uid => members.has(uid)).map(uid => [uid, members.get(uid)]));
        return members;
      },
      async ban(userId, opts) { guild.banned = { userId, opts }; },
    },
    channels: { cache: channels, async fetch(cid) { return channels.get(cid) ?? null; } },
  };
  return guild;
}

function fakeMember(guild, user, { permissions = [], position = 1, premiumSince = null } = {}) {
  const highest = fakeRole(`top-${user.id}`, { position });
  const member = {
    id: user.id,
    user,
    guild,
    displayName: user.globalName,
    displayColor: 0xF472B6,
    premiumSince,
    permissions: permissionsOf(permissions),
    roles: { highest, added: [], async add(role) { this.added.push(role); } },
    bannable: true,
    kickable: true,
    moderatable: true,
    async kick(reason) { member.kicked = reason; },
    async timeout(ms, reason) { member.timedOut = { ms, reason }; },
  };
  guild.members.cache.set(user.id, member);
  return member;
}

function fakeChannel(id = 'c1') {
  const sent = [];
  return {
    id,
    sent,
    type: 0,
    toString: () => `<#${id}>`,
    isTextBased: () => true,
    permissionsFor: () => permissionsOf([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
    async send(payload) { sent.push(payload); return { id: `m${sent.length}`, async edit() {}, async delete() {} }; },
    async sendTyping() {},
    async setRateLimitPerUser(seconds) { this.rateLimit = seconds; },
    messages: { async fetch() { return new Collection(); } },
    async bulkDelete(list) { return new Collection(list.map(m => [m.id, m])); },
  };
}

function fakeClient() {
  const bot = fakeUser(IDS.bot, 'Koharu', { bot: true });
  return {
    user: bot,
    ws: { ping: 42 },
    readyTimestamp: Date.now() - 60_000,
    users: { async fetch(id) { return fakeUser(id, `User${id}`); } },
    channels: { async fetch() { return null; } },
    guilds: { cache: new Collection() },
  };
}

let worldSeq = 0;

/** World with a fresh guild, an admin (Iris), a member (Yuki) and a channel. */
function world({ features = [] } = {}) {
  const client = fakeClient();
  const guild = fakeGuild({ id: `g${++worldSeq}`, features });
  client.guilds.cache.set(guild.id, guild);
  client.channels.fetch = async id => guild.channels.cache.get(id) ?? null;
  const channel = fakeChannel();
  guild.channels.cache.set(channel.id, channel);
  const botMember = fakeMember(guild, client.user, { permissions: [PermissionFlagsBits.Administrator], position: 50 });
  guild.members.me = botMember;
  const iris = fakeUser(IDS.iris, 'Iris');
  const yuki = fakeUser(IDS.yuki, 'Yuki');
  const irisMember = fakeMember(guild, iris, { permissions: [PermissionFlagsBits.Administrator], position: 10 });
  const yukiMember = fakeMember(guild, yuki, { position: 2 });
  return { client, guild, channel, iris, yuki, irisMember, yukiMember };
}

function optionsReader(options, sub) {
  const get = name => (options[name] === undefined ? null : options[name]);
  return {
    getSubcommand: () => sub,
    getSubcommandGroup: () => null,
    getString: get, getInteger: get, getNumber: get, getBoolean: get, getUser: get, getMember: get, getRole: get, getChannel: get,
    getFocused(full) {
      const focused = Object.entries(options).find(([, v]) => v && v.focused);
      if (!focused) return full ? { name: '', value: '' } : '';
      return full ? { name: focused[0], value: focused[1].value } : focused[1].value;
    },
  };
}

function fakeMessageFrom(payload) {
  return { id: 'reply', payload, edits: [], async edit(p) { this.edits.push(p); return this; }, async delete() {} };
}

/** A slash command interaction that records every reply. */
function slash(w, { commandName, sub = null, options = {}, user = w.iris, member = w.irisMember, locale = 'es-ES' }) {
  const interaction = {
    commandName, user, member, locale, client: w.client, guild: w.guild, guildId: w.guild.id, channel: w.channel,
    deferred: false, replied: false, replies: [],
    isAutocomplete: () => false, isChatInputCommand: () => true, isMessageComponent: () => false, isModalSubmit: () => false,
    options: optionsReader(options, sub),
    async reply(payload) { this.replied = true; this.replies.push(payload); return { resource: { message: fakeMessageFrom(payload) } }; },
    async deferReply(opts) { this.deferred = true; this.deferOptions = opts; },
    async editReply(payload) { this.replies.push(payload); this.replied = true; return fakeMessageFrom(payload); },
    async followUp(payload) { this.replies.push(payload); return fakeMessageFrom(payload); },
  };
  return interaction;
}

/** A button / select / modal interaction on a message. */
function component(w, { customId, values = [], user = w.iris, member = w.irisMember, locale = 'es-ES', message = null, fields = {} }) {
  return {
    customId, values, user, member, locale, client: w.client, guild: w.guild, guildId: w.guild.id, channel: w.channel,
    message: message ?? { components: [], async edit() {} },
    deferred: false, replied: false, replies: [], updates: [], modals: [],
    isAutocomplete: () => false, isChatInputCommand: () => false, isMessageComponent: () => true, isModalSubmit: () => false,
    fields: {
      getTextInputValue: id => fields[id] ?? '',
      getStringSelectValues: id => fields[id] ?? [],
    },
    async reply(payload) { this.replied = true; this.replies.push(payload); return {}; },
    async update(payload) { this.replied = true; this.updates.push(payload); return {}; },
    async deferUpdate() { this.deferred = true; },
    async deferReply(opts) { this.deferred = true; this.deferOptions = opts; },
    async editReply(payload) { this.updates.push(payload); return {}; },
    async followUp(payload) { this.replies.push(payload); return {}; },
    async showModal(modal) { this.modals.push(modal); },
  };
}

function autocomplete(w, { commandName, options = {}, locale = 'es-ES' }) {
  return {
    commandName, locale, user: w.iris, member: w.irisMember, guild: w.guild, guildId: w.guild.id, client: w.client,
    isAutocomplete: () => true, isChatInputCommand: () => false, isMessageComponent: () => false, isModalSubmit: () => false,
    options: optionsReader(options, null),
    responded: null,
    async respond(choices) { this.responded = choices; },
  };
}

/** A prefix-command message. */
function prefixMessage(w, content, { author = w.iris, member = w.irisMember } = {}) {
  return {
    content, author, member, guild: w.guild, channel: w.channel, client: w.client,
    replies: [],
    mentions: { users: new Collection(), members: new Collection() },
    async reply(payload) { this.replies.push(payload); return fakeMessageFrom(payload); },
    async delete() {},
  };
}

module.exports = { IDS, fakeUser, fakeRole, fakeGuild, fakeMember, fakeChannel, fakeClient, world, slash, component, autocomplete, prefixMessage };

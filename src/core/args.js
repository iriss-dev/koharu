'use strict';

/**
 * Argument helpers for prefix commands (`-bal @user`, `-dep all`, `-anime buscar frieren`).
 */

const MENTION_RE = /^<@!?(\d{15,21})>$/;
const ID_RE = /^\d{15,21}$/;
const ROLE_RE = /^<@&(\d{15,21})>$/;
const CHANNEL_RE = /^<#(\d{15,21})>$/;

function userId(token) {
  if (!token) return null;
  const mention = token.match(MENTION_RE);
  if (mention) return mention[1];
  return ID_RE.test(token) ? token : null;
}

async function user(message, token) {
  const id = userId(token);
  if (!id) return null;
  return message.client.users.fetch(id).catch(() => null);
}

async function member(message, token) {
  const id = userId(token);
  if (!id || !message.guild) return null;
  return message.guild.members.fetch(id).catch(() => null);
}

function role(message, token) {
  const id = token?.match(ROLE_RE)?.[1] ?? (ID_RE.test(token ?? '') ? token : null);
  return id ? message.guild?.roles.cache.get(id) ?? null : null;
}

function channel(message, token) {
  const id = token?.match(CHANNEL_RE)?.[1] ?? (ID_RE.test(token ?? '') ? token : null);
  return id ? message.guild?.channels.cache.get(id) ?? null : null;
}

/** Positive integer, or 'all' (returned as the string 'all'). Accepts 1k / 2.5k / 1m. */
function amount(token) {
  if (!token) return null;
  const lower = token.toLowerCase();
  if (['all', 'max', 'todo', 'todas', 'todos'].includes(lower)) return 'all';
  if (['half', 'mitad'].includes(lower)) return 'half';
  const match = lower.replace(/[,_]/g, '').match(/^(\d+(?:\.\d+)?)([km]?)$/);
  if (!match) return null;
  const mult = match[2] === 'k' ? 1_000 : match[2] === 'm' ? 1_000_000 : 1;
  const value = Math.floor(Number(match[1]) * mult);
  return value > 0 ? value : null;
}

/** Resolves an `amount()` result against a balance. */
function resolveAmount(parsed, balance) {
  if (parsed === 'all') return balance;
  if (parsed === 'half') return Math.floor(balance / 2);
  return parsed;
}

/** First mentioned / ID'd user among the args, plus the remaining text. */
async function userAndRest(message, args) {
  const index = args.findIndex(arg => userId(arg));
  if (index === -1) return { user: null, rest: args.join(' ') };
  const found = await user(message, args[index]);
  const rest = args.filter((_, i) => i !== index).join(' ');
  return { user: found, rest };
}

module.exports = { userId, user, member, role, channel, amount, resolveAmount, userAndRest };

'use strict';

/**
 * Economy cards and quick-action buttons (deposit all, work, daily) shared by
 * the economy commands.
 */

const ui = require('../../core/ui');
const emojis = require('../../core/emojis');
const router = require('../../core/router');
const { register, t, pick } = require('../../core/i18n');
const db = require('../../database/db');
const config = require('../../config');
const args = require('../../core/args');
const { formatNumber, ts, pickOne, escapeMarkdown } = require('../../utils/text');
const kawaii = require('../../services/kawaii');

register('economy', {
  es: {
    balanceTitle: 'Economía de {name}',
    wallet: 'Monedero',
    bank: 'Banco',
    net: 'Patrimonio',
    keys: 'Llaves de evento',
    rank: 'Puesto',
    rankValue: '#{rank} del servidor',
    streak: 'Racha diaria',
    streakValue: '{n} días seguidos',
    depositAll: 'Depositar todo',
    work: 'Trabajar',
    daily: 'Recompensa diaria',
    workTitle: '¡Turno terminado!',
    workEarned: 'Ganaste **+{amount}** {e:coin}',
    workNext: 'Podrás trabajar otra vez {when}.',
    restTitle: 'Toca descansar un poquito',
    restBody: 'Sigues descansando de tu último turno, **{name}**.\nVuelves a trabajar {when}.\nMientras tanto, un matcha con fresa nunca sobra {e:coffee}',
    dailyTitle: '¡Recompensa diaria!',
    dailyBody: 'Recibiste **+{amount}** {e:coin}\n{e:fire} Racha: **{streak}** {days}',
    dailyWeekly: '{e:gift} ¡Bonus por completar una semana seguida!',
    dailyNext: 'La próxima estará lista {when}. Si pasan más de 48 horas, la racha vuelve a empezar.',
    dailyWait: 'Ya la reclamaste. La próxima estará lista {when}.',
    day: 'día',
    days: 'días',
    depositTitle: 'Depósito',
    deposited: 'Guardaste **{amount}** {e:coin} en el banco {e:piggy}\nAhora tienes **{bank}** en el banco.',
    withdrawTitle: 'Retiro',
    withdrew: 'Sacaste **{amount}** {e:coin} del banco.\nTu monedero tiene **{wallet}**.',
    invalidAmount: 'Escribe una cantidad válida: un número, `1k`, `mitad` o `todo`.',
    notEnoughWallet: 'Tu monedero solo tiene **{amount}** {e:coin}.',
    notEnoughBank: 'Tu banco solo tiene **{amount}** {e:coin}.',
    payTitle: 'Transferencia',
    paid: '{e:hearts} Le enviaste **{amount}** {e:coin} a **{name}**.',
    paySelf: 'No puedes enviarte monedas a tu propia cuenta.',
    payBot: 'Los bots no necesitan monedas (aunque gracias por pensar en ellos).',
    leaderboardTitle: 'Las personas más ricas del servidor',
    leaderboardEmpty: 'Todavía nadie tiene monedas. ¡Empieza con `/trabajar` o `/diario`!',
    yourRank: 'Tu puesto: **#{rank}** con **{amount}** {e:coin}',
    keysTitle: 'Llaves de evento',
    keysGranted: 'Le diste **{n}** {e:key} a {user}. Ahora tiene **{total}**.',
    keysRevoked: 'Le quitaste **{n}** {e:key} a {user}. Le quedan **{total}**.',
    keysCheck: '{user} tiene **{total}** {e:key}.',
    jobs: [
      'Atendiste el café de gatitos sirviendo lattes de matcha con fresa',
      'Repartiste melonpan recién horneado en bicicleta por todo el barrio',
      'Ayudaste a la sacerdotisa a barrer pétalos de cerezo de las escaleras del santuario',
      'Ordenaste estanterías de manga y recomendaste shoujo en la librería',
      'Preparaste hot cakes esponjosos en un maid café',
      'Ayudaste a una mangaka poniendo tramas y entintando fondos',
      'Freíste takoyaki dorado en el puesto del festival de verano',
      'Serviste bubble teas con perlas de tapioca y miel',
      'Decoraste pasteles de fresa en la pastelería del barrio',
      'Diste clases de matemáticas a una compañera en la biblioteca',
      'Regaste las hortensias del invernadero de la azotea',
      'Cosiste peluches para el artist alley de la convención de anime',
      'Cubriste el turno de noche del konbini reponiendo onigiris',
      'Moderaste el chat de una VTuber muy tierna',
      'Montaste dioramas de anime para una exposición',
      'Hiciste de modelo para una sesión de fotos de moda kawaii',
      'Ayudaste a una tienda vintage a organizar sus percheros por colores',
    ],
  },
  en: {
    balanceTitle: '{name}\'s economy',
    wallet: 'Wallet',
    bank: 'Bank',
    net: 'Net worth',
    keys: 'Event keys',
    rank: 'Rank',
    rankValue: '#{rank} in this server',
    streak: 'Daily streak',
    streakValue: '{n} days in a row',
    depositAll: 'Deposit all',
    work: 'Work',
    daily: 'Daily reward',
    workTitle: 'Shift complete!',
    workEarned: 'You earned **+{amount}** {e:coin}',
    workNext: 'You can work again {when}.',
    restTitle: 'Time for a little rest',
    restBody: 'You are still resting from your last shift, **{name}**.\nYou can work again {when}.\nMeanwhile, a strawberry matcha never hurts {e:coffee}',
    dailyTitle: 'Daily reward!',
    dailyBody: 'You received **+{amount}** {e:coin}\n{e:fire} Streak: **{streak}** {days}',
    dailyWeekly: '{e:gift} Bonus for a full week in a row!',
    dailyNext: 'The next one is ready {when}. If more than 48 hours pass, the streak starts over.',
    dailyWait: 'You already claimed it. The next one is ready {when}.',
    day: 'day',
    days: 'days',
    depositTitle: 'Deposit',
    deposited: 'You stored **{amount}** {e:coin} in the bank {e:piggy}\nYou now have **{bank}** in the bank.',
    withdrawTitle: 'Withdrawal',
    withdrew: 'You took **{amount}** {e:coin} out of the bank.\nYour wallet has **{wallet}**.',
    invalidAmount: 'Enter a valid amount: a number, `1k`, `half` or `all`.',
    notEnoughWallet: 'Your wallet only has **{amount}** {e:coin}.',
    notEnoughBank: 'Your bank only has **{amount}** {e:coin}.',
    payTitle: 'Transfer',
    paid: '{e:hearts} You sent **{amount}** {e:coin} to **{name}**.',
    paySelf: 'You cannot send coins to your own account.',
    payBot: 'Bots do not need coins (thank you for thinking of them, though).',
    leaderboardTitle: 'Richest people in the server',
    leaderboardEmpty: 'Nobody has coins yet. Start with `/work` or `/daily`!',
    yourRank: 'Your rank: **#{rank}** with **{amount}** {e:coin}',
    keysTitle: 'Event keys',
    keysGranted: 'You gave **{n}** {e:key} to {user}. They now have **{total}**.',
    keysRevoked: 'You took **{n}** {e:key} from {user}. They have **{total}** left.',
    keysCheck: '{user} has **{total}** {e:key}.',
    jobs: [
      'Worked a shift at the cat café serving strawberry matcha lattes',
      'Delivered freshly baked melonpan by bike across town',
      'Helped the shrine maiden sweep cherry blossom petals off the stairs',
      'Organised manga shelves and recommended shoujo at the bookstore',
      'Made fluffy soufflé pancakes at a maid café',
      'Helped a mangaka with screentones and background inking',
      'Fried golden takoyaki at the summer festival stall',
      'Served bubble teas with honey tapioca pearls',
      'Decorated strawberry shortcakes at the neighbourhood patisserie',
      'Tutored a classmate in maths at the library',
      'Watered the hydrangeas in the rooftop greenhouse',
      'Sewed plushies for the anime convention artist alley',
      'Covered the night shift at the konbini restocking onigiri',
      'Moderated chat for a very cosy VTuber',
      'Built anime dioramas for an exhibition',
      'Modelled for a kawaii fashion photoshoot',
      'Helped a vintage shop sort its racks by colour',
    ],
  },
});

const L = (locale, key, vars) => t(locale, `economy.${key}`, vars);
const n = (locale, value) => formatNumber(locale, value);

function balanceMessage(locale, { guild, user, member }) {
  const row = db.member(guild.id, user.id);
  const name = member?.displayName ?? user.username;
  const lines = [
    ui.bullet('coin', L(locale, 'wallet'), `**${n(locale, row.coins)}**`),
    ui.bullet('piggy', L(locale, 'bank'), `**${n(locale, row.bank)}**`),
    ui.bullet('crown', L(locale, 'net'), `**${n(locale, row.coins + row.bank)}**`),
    ui.bullet('key', L(locale, 'keys'), `**${n(locale, row.keys)}**`),
  ];
  if (row.coins + row.bank > 0) lines.push(ui.bullet('trophy', L(locale, 'rank'), L(locale, 'rankValue', { rank: db.rank(guild.id, user.id) })));
  if (row.daily_streak) lines.push(ui.bullet('fire', L(locale, 'streak'), L(locale, 'streakValue', { n: row.daily_streak })));

  const card = ui.card({
    accent: 'primary',
    emoji: 'coin',
    title: L(locale, 'balanceTitle', { name: escapeMarkdown(name) }),
    intro: lines.join('\n'),
    // A small happy anime GIF on the right (the avatar if the GIF service is cold).
    thumbnail: kawaii.moodNow('money')?.url ?? user.displayAvatarURL({ size: 256, extension: 'png' }),
    subtitle: `@${user.username}`,
    body: [
      ui.row(
        ui.button({ id: router.encode('eco', 'depall', user.id), label: L(locale, 'depositAll'), emoji: 'piggy', style: 'primary', disabled: row.coins <= 0 }),
        ui.button({ id: router.encode('eco', 'work', user.id), label: L(locale, 'work'), emoji: 'coffee' }),
        ui.button({ id: router.encode('eco', 'daily', user.id), label: L(locale, 'daily'), emoji: 'gift' }),
      ),
    ],
  });
  return ui.message(card);
}

/** @returns {{ payload: object, ok: boolean }} */
function work(locale, { guildId, userId, name }, now = Math.floor(Date.now() / 1000), random = Math.random) {
  const row = db.member(guildId, userId);
  const readyAt = (row.last_work || 0) + config.economy.workCooldown;
  if (now < readyAt) {
    const gif = kawaii.moodNow('sleepy');
    const cat = gif ? null : ui.asset('cat_yawn.png');
    const card = ui.card({
      accent: 'lavender',
      emoji: 'moon',
      title: L(locale, 'restTitle'),
      intro: ui.quote(L(locale, 'restBody', { name: escapeMarkdown(name), when: ts(readyAt, 'R') })),
      thumbnail: gif?.url ?? cat.url,
    });
    return { ok: false, payload: ui.message(card, { files: cat ? [cat.attachment] : [], ephemeral: true }) };
  }
  const { workMin, workMax } = config.economy;
  const earned = workMin + Math.floor(random() * (workMax - workMin + 1));
  const job = pickOne(L(locale, 'jobs'), random);
  const updated = db.addCoins(guildId, userId, earned);
  db.setLastWork(guildId, userId, now);
  const card = ui.card({
    accent: 'mint',
    emoji: 'coffee',
    title: L(locale, 'workTitle'),
    intro: ui.quote(`*${job}*\n${L(locale, 'workEarned', { amount: n(locale, earned) })}`),
    thumbnail: kawaii.moodNow('work')?.url,
    body: [ui.sub(`${L(locale, 'wallet')}: ${n(locale, updated.coins)} · ${L(locale, 'workNext', { when: ts(now + config.economy.workCooldown, 'R') })}`)],
  });
  return { ok: true, payload: ui.message(card) };
}

function daily(locale, { guildId, userId }) {
  const result = db.claimDaily(guildId, userId);
  if (!result.ok) {
    return { ok: false, payload: ui.message(ui.notice('info', L(locale, 'dailyTitle'), L(locale, 'dailyWait', { when: ts(result.nextAt, 'R') })), { ephemeral: true }) };
  }
  const intro = ui.quote(L(locale, 'dailyBody', { amount: n(locale, result.reward), streak: result.streak, days: result.streak === 1 ? L(locale, 'day') : L(locale, 'days') }));
  const body = [];
  if (result.weekly) body.push(L(locale, 'dailyWeekly'));
  body.push(ui.sub(L(locale, 'dailyNext', { when: ts(result.nextAt, 'R') })));
  return { ok: true, payload: ui.message(ui.card({ accent: 'gold', emoji: 'gift', title: L(locale, 'dailyTitle'), intro, thumbnail: kawaii.moodNow('daily')?.url, body })) };
}

/** Moves coins between wallet and bank. kind = 'deposit' | 'withdraw'. */
function bankMove(locale, { guildId, userId, input, kind }) {
  const row = db.member(guildId, userId);
  const source = kind === 'deposit' ? row.coins : row.bank;
  const parsed = typeof input === 'number' ? input : args.amount(String(input ?? ''));
  const amount = parsed === null ? null : args.resolveAmount(parsed, source);
  const title = L(locale, kind === 'deposit' ? 'depositTitle' : 'withdrawTitle');
  if (!amount || amount <= 0) {
    if (parsed !== null && source <= 0) {
      return ui.message(ui.notice('warn', title, L(locale, kind === 'deposit' ? 'notEnoughWallet' : 'notEnoughBank', { amount: n(locale, source) })), { ephemeral: true });
    }
    return ui.message(ui.notice('warn', title, L(locale, 'invalidAmount')), { ephemeral: true });
  }
  if (amount > source) {
    return ui.message(ui.notice('warn', title, L(locale, kind === 'deposit' ? 'notEnoughWallet' : 'notEnoughBank', { amount: n(locale, source) })), { ephemeral: true });
  }
  const updated = kind === 'deposit' ? db.deposit(guildId, userId, amount) : db.withdraw(guildId, userId, amount);
  const text = kind === 'deposit'
    ? L(locale, 'deposited', { amount: n(locale, amount), bank: n(locale, updated.bank) })
    : L(locale, 'withdrew', { amount: n(locale, amount), wallet: n(locale, updated.coins) });
  return ui.message(ui.notice('success', title, text));
}

router.register('eco', async (interaction, route, { locale }) => {
  const guildId = interaction.guild?.id;
  if (!guildId) return interaction.deferUpdate();
  const userId = interaction.user.id;

  if (route.action === 'depall') {
    const row = db.member(guildId, userId);
    if (row.coins > 0) db.deposit(guildId, userId, row.coins);
    return interaction.update(ui.forEdit(balanceMessage(locale, { guild: interaction.guild, user: interaction.user, member: interaction.member })));
  }
  if (route.action === 'work') {
    const result = work(locale, { guildId, userId, name: interaction.member?.displayName ?? interaction.user.username });
    return interaction.reply(result.payload);
  }
  if (route.action === 'daily') {
    return interaction.reply(daily(locale, { guildId, userId }).payload);
  }
  if (route.action === 'lb') {
    const page = Number(route.args[0]) || 0;
    const { leaderboardMessage } = module.exports;
    return interaction.update(ui.forEdit(await leaderboardMessage(locale, interaction.guild, userId, page)));
  }
  if (route.action === 'noop') return interaction.deferUpdate();
  return null;
});

const LB_PER_PAGE = 10;

async function leaderboardMessage(locale, guild, viewerId, page = 0) {
  const total = db.leaderboardCount(guild.id);
  const pages = Math.max(1, Math.ceil(total / LB_PER_PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const rows = db.leaderboard(guild.id, LB_PER_PAGE, current * LB_PER_PAGE);

  if (!rows.length) return ui.message(ui.notice('info', L(locale, 'leaderboardTitle'), L(locale, 'leaderboardEmpty')));

  const members = await guild.members.fetch({ user: rows.map(r => r.user_id) }).catch(() => null);
  const medals = ['crown', 'trophy', 'star'];
  const lines = rows.map((row, i) => {
    const position = current * LB_PER_PAGE + i + 1;
    const member = members?.get?.(row.user_id);
    const name = escapeMarkdown(member?.displayName ?? `#${row.user_id.slice(-4)}`);
    const badge = position <= 3 ? emojis.e(medals[position - 1]) : `\`#${position}\``;
    return `${badge} **${name}** · ${n(locale, row.net_worth)} ${emojis.e('coin')}`;
  });

  const viewer = db.member(guild.id, viewerId);
  const body = ['sep', lines.join('\n')];
  if (viewer.coins + viewer.bank > 0) body.push(ui.sub(L(locale, 'yourRank', { rank: db.rank(guild.id, viewerId), amount: n(locale, viewer.coins + viewer.bank) })));
  if (pages > 1) {
    body.push(ui.row(
      ui.button({ id: router.encode('eco', 'lb', '*', current - 1), emoji: 'arrow_left', disabled: current === 0 }),
      ui.button({ id: router.encode('eco', 'noop', '*', 'lbi'), label: t(locale, 'common.page', { page: current + 1, pages }), disabled: true }),
      ui.button({ id: router.encode('eco', 'lb', '*', current + 1), emoji: 'arrow_right', disabled: current >= pages - 1 }),
    ));
  }
  return ui.message(ui.card({ accent: 'gold', emoji: 'trophy', title: L(locale, 'leaderboardTitle'), subtitle: guild.name, body }));
}

module.exports = { balanceMessage, work, daily, bankMove, leaderboardMessage, L };

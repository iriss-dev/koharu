'use strict';

/**
 * Anime-style marriages: a proposal with Accept / Decline buttons that only
 * the person being asked can press, a ring on both profiles, and a divorce
 * that needs one confirmation. Marriages are global, like profiles.
 */

const ui = require('../../core/ui');
const router = require('../../core/router');
const { register, t } = require('../../core/i18n');
const db = require('../../database/db');
const kawaii = require('../../services/kawaii');
const { escapeMarkdown, ts } = require('../../utils/text');

register('marriage', {
  es: {
    proposalTitle: '¡Propuesta de matrimonio!',
    proposal: '{e:ribbon} {a} se arrodilla frente a {b} con un anillo en la mano…\n**¿Aceptas casarte?**',
    proposalFooter: 'Solo {name} puede responder',
    accept: 'Acepto',
    decline: 'Mejor no',
    acceptedTitle: '¡Felicidades a la nueva pareja!',
    accepted: '{e:hearts} ¡{a} y {b} se casaron! Que viva el amor.',
    declinedTitle: 'Propuesta rechazada',
    declined: '{e:moon} {b} rechazó la propuesta de {a}. Habrá otra oportunidad…',
    expired: 'La propuesta ya no es válida: alguien ya se casó mientras tanto.',
    self: 'Casarte contigo es muy tierno, pero necesito a otra persona {e:heart}',
    bot: 'Me halagas, pero soy una bot ocupada {e:ribbon}',
    already: 'Ya estás en una relación con {partner}. Usa `/divorcio` primero.',
    taken: '{name} ya está en una relación con otra persona.',
    single: 'No estás en un matrimonio ahora mismo.',
    divorceTitle: '¿Seguro que quieres divorciarte?',
    divorceAsk: 'Tu matrimonio con {partner} terminará para siempre.',
    divorceYes: 'Sí, divorciarme',
    divorceNo: 'Lo pensaré',
    divorcedTitle: 'Divorcio firmado',
    divorced: '{e:moon} {a} y {b} tomaron caminos separados.',
    kept: '{e:heart} ¡Qué alivio! El matrimonio sigue en pie.',
    statusTitle: 'Matrimonio',
    status: '{e:ribbon} En matrimonio con {partner} desde {since}',
  },
  en: {
    proposalTitle: 'A marriage proposal!',
    proposal: '{e:ribbon} {a} kneels in front of {b} with a ring in hand…\n**Will you marry me?**',
    proposalFooter: 'Only {name} can answer',
    accept: 'I do',
    decline: 'Maybe not',
    acceptedTitle: 'Congratulations to the new couple!',
    accepted: '{e:hearts} {a} and {b} just got married! Long live love.',
    declinedTitle: 'Proposal declined',
    declined: '{e:moon} {b} declined {a}\'s proposal. There will be another chance…',
    expired: 'This proposal is no longer valid: someone got married in the meantime.',
    self: 'Marrying yourself is sweet, but I need someone else {e:heart}',
    bot: 'I am flattered, but I am a very busy bot {e:ribbon}',
    already: 'You are already with {partner}. Use `/divorce` first.',
    taken: '{name} is already with someone else.',
    single: 'You are not married right now.',
    divorceTitle: 'Are you sure you want a divorce?',
    divorceAsk: 'Your marriage with {partner} will end for good.',
    divorceYes: 'Yes, divorce',
    divorceNo: 'Let me think',
    divorcedTitle: 'Divorce signed',
    divorced: '{e:moon} {a} and {b} went their separate ways.',
    kept: '{e:heart} Phew! The marriage is still standing.',
    statusTitle: 'Marriage',
    status: '{e:ribbon} Married to {partner} since {since}',
  },
});

const L = (locale, key, vars) => t(locale, `marriage.${key}`, vars);
const bold = name => `**${escapeMarkdown(name)}**`;

async function proposalMessage(locale, { from, to }) {
  const gif = await kawaii.mood('love').catch(() => null);
  const body = [];
  if (gif) body.push(ui.gallery({ url: gif.url, description: L(locale, 'proposalTitle') }));
  body.push(ui.row(
    ui.button({ id: router.encode('marry', 'yes', to.id, from.id), label: L(locale, 'accept'), emoji: 'hearts', style: 'success' }),
    ui.button({ id: router.encode('marry', 'no', to.id, from.id), label: L(locale, 'decline'), emoji: 'cross' }),
  ));
  return ui.message(ui.card({
    accent: 'rose',
    emoji: 'ribbon',
    title: L(locale, 'proposalTitle'),
    intro: ui.quote(L(locale, 'proposal', { a: bold(from.name), b: `<@${to.id}>` })),
    body,
    footer: L(locale, 'proposalFooter', { name: to.name }),
  }));
}

/** Checks both people can marry; returns an error payload or null. */
function checkProposal(locale, { from, to }) {
  const deny = key => ui.message(ui.notice('warn', L(locale, 'proposalTitle'), key), { ephemeral: true });
  if (from.id === to.id) return deny(L(locale, 'self'));
  if (to.bot) return deny(L(locale, 'bot'));
  const mine = db.partner(from.id);
  if (mine) return deny(L(locale, 'already', { partner: `<@${mine.partner_id}>` }));
  if (db.partner(to.id)) return deny(L(locale, 'taken', { name: escapeMarkdown(to.name) }));
  return null;
}

function statusLine(locale, userId) {
  const row = db.partner(userId);
  if (!row) return null;
  return L(locale, 'status', { partner: `<@${row.partner_id}>`, since: ts(row.since, 'D') });
}

function divorceAsk(locale, userId) {
  const row = db.partner(userId);
  if (!row) return ui.message(ui.notice('info', L(locale, 'statusTitle'), L(locale, 'single')), { ephemeral: true });
  const gif = kawaii.moodNow('sad');
  return ui.message(ui.card({
    accent: 'lavender',
    emoji: 'moon',
    title: L(locale, 'divorceTitle'),
    intro: ui.quote(L(locale, 'divorceAsk', { partner: `<@${row.partner_id}>` })),
    thumbnail: gif?.url,
    body: [ui.row(
      ui.button({ id: router.encode('marry', 'divorce', userId), label: L(locale, 'divorceYes'), emoji: 'cross', style: 'danger' }),
      ui.button({ id: router.encode('marry', 'keep', userId), label: L(locale, 'divorceNo'), emoji: 'heart' }),
    )],
  }), { ephemeral: true });
}

const nameOf = async (interaction, id) => {
  const member = interaction.guild ? await interaction.guild.members.fetch(id).catch(() => null) : null;
  if (member) return member.displayName;
  const user = await interaction.client.users.fetch(id).catch(() => null);
  return user?.globalName ?? user?.username ?? '…';
};

router.register('marry', async (interaction, route, { locale }) => {
  const me = interaction.user.id;
  const myName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

  if (route.action === 'yes' || route.action === 'no') {
    const proposerId = route.args[0];
    const proposerName = await nameOf(interaction, proposerId);
    if (route.action === 'no') {
      const gif = await kawaii.mood('sad').catch(() => null);
      return interaction.update(ui.forEdit(ui.message(ui.card({
        accent: 'lavender',
        emoji: 'moon',
        title: L(locale, 'declinedTitle'),
        intro: ui.quote(L(locale, 'declined', { a: bold(proposerName), b: bold(myName) })),
        thumbnail: gif?.url,
      }))));
    }
    if (!db.marry(proposerId, me)) {
      return interaction.update(ui.forEdit(ui.message(ui.notice('info', L(locale, 'proposalTitle'), L(locale, 'expired')))));
    }
    const gif = await kawaii.gif(['kiss', 'hug', 'cuddle', 'handhold'][Math.floor(Math.random() * 4)]).catch(() => null);
    return interaction.update(ui.forEdit(ui.message(ui.card({
      accent: 'rose',
      emoji: 'hearts',
      title: L(locale, 'acceptedTitle'),
      intro: ui.quote(L(locale, 'accepted', { a: `<@${proposerId}>`, b: `<@${me}>` })),
      body: gif ? [ui.gallery({ url: gif.url, description: L(locale, 'acceptedTitle') })] : [],
    }))));
  }

  if (route.action === 'divorce') {
    const former = db.divorce(me);
    if (!former) return interaction.update(ui.forEdit(ui.message(ui.notice('info', L(locale, 'statusTitle'), L(locale, 'single')))));
    const formerName = await nameOf(interaction, former);
    const gif = await kawaii.mood('bye').catch(() => null);
    // Private confirmation for the button, public note for the server.
    await interaction.update(ui.forEdit(ui.message(ui.notice('success', L(locale, 'divorcedTitle'), L(locale, 'divorced', { a: bold(myName), b: bold(formerName) })))));
    return interaction.followUp(ui.message(ui.card({
      accent: 'lavender',
      emoji: 'moon',
      title: L(locale, 'divorcedTitle'),
      intro: ui.quote(L(locale, 'divorced', { a: bold(myName), b: bold(formerName) })),
      thumbnail: gif?.url,
    })));
  }
  if (route.action === 'keep') {
    return interaction.update(ui.forEdit(ui.message(ui.notice('success', L(locale, 'statusTitle'), L(locale, 'kept')))));
  }
  return null;
});

module.exports = { L, proposalMessage, checkProposal, statusLine, divorceAsk };

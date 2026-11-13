'use strict';

/**
 * Custom roles: panel → modal (name, colour, payment) → preview with a colour
 * image → confirm. Payment is taken atomically and refunded if Discord rejects
 * the role change. Boosters can use two colours: a real gradient role when the
 * server has Discord's enhanced role colours, otherwise a blend of both.
 */

const {
  ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, StringSelectMenuBuilder, PermissionFlagsBits, GuildFeature,
} = require('discord.js');
const ui = require('../../core/ui');
const router = require('../../core/router');
const emojis = require('../../core/emojis');
const { register, t } = require('../../core/i18n');
const db = require('../../database/db');
const colors = require('../../utils/colors');
const png = require('../../utils/png');
const { formatNumber, cleanUserText } = require('../../utils/text');

register('roles', {
  es: {
    panelTitle: 'Tu rol personalizado',
    panelIntro: 'Crea un rol con tu nombre y tu color favorito, y cámbialo cuando quieras desde aquí.',
    features: [
      '{e:palette} Cualquier nombre y cualquier color (código o nombre, como `lavanda`).',
      '{e:sparkle} Los boosters del servidor pueden usar **dos colores** para un degradado.',
      '{e:shield} Koharu coloca el rol en su sitio, debajo de los roles del staff.',
    ],
    pricing: 'Precio',
    priceCoins: '{amount} monedas',
    priceKeys: '{amount} llaves',
    boosterFree: 'Gratis para boosters {e:sparkle}',
    free: 'Gratis',
    configure: 'Configurar rol',
    modalCreate: 'Crear rol personalizado',
    modalEdit: 'Editar tu rol',
    nameLabel: 'Nombre del rol',
    namePlaceholder: 'p. ej. Flor de cerezo',
    colorLabel: 'Color',
    colorHint: 'Código (#F472B6) o nombre (lavanda, verde salvia…)',
    colorHintBooster: 'Uno o dos colores separados por coma para un degradado',
    paymentLabel: 'Forma de pago',
    payCoins: 'Monedas ({amount})',
    payKeys: 'Llaves de evento ({amount})',
    previewTitle: 'Así quedará tu rol',
    previewName: 'Nombre',
    previewColor: 'Color',
    previewGradient: 'Degradado',
    previewBlend: 'Este servidor aún no tiene degradados de rol, así que usaré la mezcla de ambos: {hex}.',
    previewCost: 'Costo',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    created: '{e:sakura} ¡Tu rol {role} está listo!',
    updated: '{e:sakura} Actualicé tu rol {role}.',
    cancelled: 'Cancelado. No se cobró nada.',
    badColor: '«{input}» no es un color que reconozca. Usa un código como `#F472B6` o un nombre como `lavanda`.',
    boosterOnly: 'Los degradados de dos colores son un regalo para quienes impulsan el servidor {e:sparkle}.',
    notEnoughCoins: 'Necesitas **{cost}** monedas en el monedero y tienes **{have}**.',
    notEnoughKeys: 'Necesitas **{cost}** llaves y tienes **{have}**.',
    botPerm: 'Me falta el permiso **Gestionar roles**, o mi rol está por debajo del tuyo.',
    failed: 'Discord no me dejó hacer el cambio ({reason}). Te devolví lo que pagaste.',
    expired: 'Esta vista previa expiró. Vuelve a pulsar «Configurar rol».',
    panelPosted: 'Publiqué el panel en {channel}.',
    configSaved: 'Guardé la configuración de roles.',
    anchor: 'Ancla de jerarquía',
    anchorNone: 'debajo de mi rol más alto',
    dualColor: 'Degradados para boosters',
  },
  en: {
    panelTitle: 'Your custom role',
    panelIntro: 'Create a role with your own name and favourite colour, and change it any time from here.',
    features: [
      '{e:palette} Any name and any colour (a code or a name, like `lavender`).',
      '{e:sparkle} Server boosters can use **two colours** for a gradient.',
      '{e:shield} Koharu puts the role in the right place, below staff roles.',
    ],
    pricing: 'Price',
    priceCoins: '{amount} coins',
    priceKeys: '{amount} keys',
    boosterFree: 'Free for boosters {e:sparkle}',
    free: 'Free',
    configure: 'Set up role',
    modalCreate: 'Create custom role',
    modalEdit: 'Edit your role',
    nameLabel: 'Role name',
    namePlaceholder: 'e.g. Cherry Blossom',
    colorLabel: 'Colour',
    colorHint: 'A code (#F472B6) or a name (lavender, sage green…)',
    colorHintBooster: 'One or two colours separated by a comma for a gradient',
    paymentLabel: 'Payment',
    payCoins: 'Coins ({amount})',
    payKeys: 'Event keys ({amount})',
    previewTitle: 'Your role will look like this',
    previewName: 'Name',
    previewColor: 'Colour',
    previewGradient: 'Gradient',
    previewBlend: 'This server does not have role gradients yet, so I will use a blend of both: {hex}.',
    previewCost: 'Cost',
    confirm: 'Confirm',
    cancel: 'Cancel',
    created: '{e:sakura} Your role {role} is ready!',
    updated: '{e:sakura} I updated your role {role}.',
    cancelled: 'Cancelled. Nothing was charged.',
    badColor: '“{input}” is not a colour I recognise. Use a code like `#F472B6` or a name like `lavender`.',
    boosterOnly: 'Two-colour gradients are a thank-you for people who boost the server {e:sparkle}.',
    notEnoughCoins: 'You need **{cost}** coins in your wallet and have **{have}**.',
    notEnoughKeys: 'You need **{cost}** keys and have **{have}**.',
    botPerm: 'I am missing **Manage Roles**, or my role is below yours.',
    failed: 'Discord would not let me make the change ({reason}). I refunded your payment.',
    expired: 'This preview expired. Press “Set up role” again.',
    panelPosted: 'I posted the panel in {channel}.',
    configSaved: 'Role settings saved.',
    anchor: 'Hierarchy anchor',
    anchorNone: 'below my highest role',
    dualColor: 'Gradients for boosters',
  },
});

const L = (locale, key, vars) => t(locale, `roles.${key}`, vars);
const isBooster = member => Boolean(member?.premiumSince);

function paymentMethods(settings, booster) {
  if (booster && settings.booster_free) return [];
  const methods = [];
  if (settings.role_cost_coins > 0) methods.push('coins');
  if (settings.role_cost_keys > 0) methods.push('keys');
  return methods;
}

function priceLines(locale, settings) {
  const lines = [];
  if (settings.role_cost_coins > 0) lines.push(`${emojis.e('coin')} ${L(locale, 'priceCoins', { amount: formatNumber(locale, settings.role_cost_coins) })}`);
  if (settings.role_cost_keys > 0) lines.push(`${emojis.e('key')} ${L(locale, 'priceKeys', { amount: settings.role_cost_keys })}`);
  if (!lines.length) lines.push(`${emojis.e('gift')} ${L(locale, 'free')}`);
  if (settings.booster_free) lines.push(`${emojis.e('sparkle')} ${L(locale, 'boosterFree')}`);
  return lines.join('\n');
}

function panelMessage(locale, settings) {
  const banner = ui.asset('banner.png');
  return ui.message(ui.card({
    accent: 'primary',
    emoji: 'palette',
    title: L(locale, 'panelTitle'),
    intro: ui.quote(L(locale, 'panelIntro')),
    body: [
      'sep',
      L(locale, 'features').join('\n'),
      `**${L(locale, 'pricing')}**\n${priceLines(locale, settings)}`,
      ui.gallery({ url: banner.url, description: L(locale, 'panelTitle') }),
      ui.row(ui.button({ id: router.encode('roles', 'configure', '*'), label: L(locale, 'configure'), emoji: 'palette', style: 'primary' })),
    ],
  }), { files: [banner.attachment] });
}

/** The member's current custom role in this guild, adopting one from older versions. */
function currentRole(guild, userId) {
  const id = db.customRole(guild.id, userId);
  if (id) return guild.roles.cache.get(id) ?? null;
  const legacy = db.legacyCustomRole(userId);
  if (legacy && guild.roles.cache.has(legacy)) {
    db.adoptLegacyRole(guild.id, userId, legacy);
    return guild.roles.cache.get(legacy);
  }
  return null;
}

function buildModal(locale, interaction) {
  const settings = db.guildSettings(interaction.guild.id);
  const booster = isBooster(interaction.member);
  const existing = currentRole(interaction.guild, interaction.user.id);

  const name = new TextInputBuilder().setCustomId('name').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(32).setRequired(true).setPlaceholder(L(locale, 'namePlaceholder'));
  if (existing) name.setValue(existing.name.slice(0, 32));
  const color = new TextInputBuilder().setCustomId('color').setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(40).setRequired(true);
  if (existing) color.setValue(existing.hexColor.toUpperCase());

  const modal = new ModalBuilder()
    .setCustomId(router.encode('roles', 'modal', interaction.user.id))
    .setTitle(L(locale, existing ? 'modalEdit' : 'modalCreate'))
    .addLabelComponents(
      new LabelBuilder().setLabel(L(locale, 'nameLabel')).setTextInputComponent(name),
      new LabelBuilder().setLabel(L(locale, 'colorLabel'))
        .setDescription(L(locale, booster && settings.booster_dual_color ? 'colorHintBooster' : 'colorHint'))
        .setTextInputComponent(color),
    );

  const methods = paymentMethods(settings, booster);
  if (methods.length) {
    const menu = new StringSelectMenuBuilder().setCustomId('payment').setMinValues(1).setMaxValues(1);
    if (methods.includes('coins')) menu.addOptions({ label: L(locale, 'payCoins', { amount: formatNumber(locale, settings.role_cost_coins) }), value: 'coins', emoji: emojis.component('coin'), default: true });
    if (methods.includes('keys')) menu.addOptions({ label: L(locale, 'payKeys', { amount: settings.role_cost_keys }), value: 'keys', emoji: emojis.component('key'), default: !methods.includes('coins') });
    modal.addLabelComponents(new LabelBuilder().setLabel(L(locale, 'paymentLabel')).setStringSelectMenuComponent(menu));
  }
  return modal;
}

/** Parses "pink", "#F472B6" or "#F472B6, lavender". */
function parseColors(input) {
  const parts = String(input ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 2);
  const parsed = parts.map(colors.parseColor);
  const bad = parts.find((_, i) => !parsed[i]);
  return { colors: parsed.filter(Boolean), bad: bad ?? null };
}

function previewMessage(locale, draft) {
  const [primary, secondary] = draft.colors;
  const image = ui.bufferAttachment(png.rolePreview(primary, secondary ?? null), 'role-preview.png');
  const lines = [ui.bullet('chat', L(locale, 'previewName'), `**${cleanUserText(draft.name, 32)}**`)];
  if (secondary) lines.push(ui.bullet('palette', L(locale, 'previewGradient'), `\`${primary}\` → \`${secondary}\``));
  else lines.push(ui.bullet('palette', L(locale, 'previewColor'), `\`${primary}\` · ${colors.nearestName(primary, locale).name}`));
  lines.push(ui.bullet(draft.method === 'keys' ? 'key' : draft.method === 'coins' ? 'coin' : 'gift', L(locale, 'previewCost'), draft.costLabel));

  const body = ['sep', lines.join('\n'), ui.gallery({ url: image.url, description: draft.name })];
  if (secondary && !draft.realGradient) body.push(ui.sub(L(locale, 'previewBlend', { hex: colors.blendColors(primary, secondary) })));
  body.push(ui.row(
    ui.button({ id: router.encode('roles', 'confirm', draft.userId, draft.session), label: L(locale, 'confirm'), emoji: 'check', style: 'success' }),
    ui.button({ id: router.encode('roles', 'cancel', draft.userId, draft.session), label: L(locale, 'cancel'), emoji: 'cross' }),
  ));
  return ui.message(ui.card({ accent: primary, emoji: 'palette', title: L(locale, 'previewTitle'), body }), { files: [image.attachment], ephemeral: true });
}

async function handleModal(interaction, locale) {
  const guild = interaction.guild;
  const settings = db.guildSettings(guild.id);
  const booster = isBooster(interaction.member);
  const name = interaction.fields.getTextInputValue('name').trim().slice(0, 32);
  const parsed = parseColors(interaction.fields.getTextInputValue('color'));

  const fail = text => interaction.reply(ui.message(ui.notice('warn', L(locale, 'panelTitle'), text), { ephemeral: true }));
  if (parsed.bad || !parsed.colors.length) return fail(L(locale, 'badColor', { input: cleanUserText(parsed.bad ?? '', 40) }));
  if (parsed.colors.length > 1 && !(booster && settings.booster_dual_color)) return fail(L(locale, 'boosterOnly'));

  const methods = paymentMethods(settings, booster);
  let method = 'free';
  if (methods.length) {
    const chosen = interaction.fields.getStringSelectValues?.('payment')?.[0];
    method = methods.includes(chosen) ? chosen : methods[0];
  }
  const costLabel = method === 'coins'
    ? L(locale, 'priceCoins', { amount: formatNumber(locale, settings.role_cost_coins) })
    : method === 'keys' ? L(locale, 'priceKeys', { amount: settings.role_cost_keys })
      : booster && settings.booster_free ? L(locale, 'boosterFree') : L(locale, 'free');

  const draft = {
    userId: interaction.user.id,
    guildId: guild.id,
    name,
    colors: parsed.colors,
    method,
    costLabel,
    realGradient: parsed.colors.length > 1 && guild.features.includes(GuildFeature.EnhancedRoleColors),
  };
  draft.session = router.createSession(draft, 10 * 60 * 1000);
  return interaction.reply(previewMessage(locale, draft));
}

function rolePosition(guild, settings) {
  const anchor = settings.anchor_role_id ? guild.roles.cache.get(settings.anchor_role_id) : null;
  const top = anchor ?? guild.members.me.roles.highest;
  return Math.max(1, top.position - 1);
}

async function handleConfirm(interaction, locale, sessionId) {
  const draft = router.getSession(sessionId);
  if (!draft) return interaction.update(ui.forEdit(ui.message(ui.notice('info', L(locale, 'panelTitle'), L(locale, 'expired')))));
  router.deleteSession(sessionId); // one confirmation per preview, even on double clicks

  const guild = interaction.guild;
  const settings = db.guildSettings(guild.id);
  const member = interaction.member;
  const fail = text => interaction.update({ ...ui.forEdit(ui.message(ui.notice('warn', L(locale, 'panelTitle'), text))), attachments: [] });

  if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return fail(L(locale, 'botPerm'));

  // Charge first, atomically.
  if (draft.method === 'coins' && !db.spendCoins(guild.id, member.id, settings.role_cost_coins)) {
    return fail(L(locale, 'notEnoughCoins', { cost: formatNumber(locale, settings.role_cost_coins), have: formatNumber(locale, db.member(guild.id, member.id).coins) }));
  }
  if (draft.method === 'keys' && !db.spendKeys(guild.id, member.id, settings.role_cost_keys)) {
    return fail(L(locale, 'notEnoughKeys', { cost: settings.role_cost_keys, have: db.member(guild.id, member.id).keys }));
  }
  const refund = () => {
    if (draft.method === 'coins') db.addCoins(guild.id, member.id, settings.role_cost_coins);
    if (draft.method === 'keys') db.addKeys(guild.id, member.id, settings.role_cost_keys);
  };

  const [primary, secondary] = draft.colors;
  const roleColors = secondary && draft.realGradient
    ? { primaryColor: primary, secondaryColor: secondary }
    : { primaryColor: secondary ? colors.blendColors(primary, secondary) : primary };

  try {
    let role = currentRole(guild, member.id);
    const existed = Boolean(role);
    if (role) {
      role = await role.edit({ name: draft.name, colors: roleColors, reason: `Koharu custom role (${member.user.tag})` });
    } else {
      role = await guild.roles.create({ name: draft.name, colors: roleColors, permissions: [], reason: `Koharu custom role (${member.user.tag})` });
      await role.setPosition(rolePosition(guild, settings)).catch(() => null);
      await member.roles.add(role);
      db.setCustomRole(guild.id, member.id, role.id);
    }
    db.recordRolePurchase(member.id, guild.id, role.id, draft.name, primary, draft.method);
    return interaction.update({
      ...ui.forEdit(ui.message(ui.notice('success', L(locale, 'panelTitle'), L(locale, existed ? 'updated' : 'created', { role: role.toString() })))),
      attachments: [],
    });
  } catch (err) {
    refund();
    return fail(L(locale, 'failed', { reason: String(err?.message ?? err).slice(0, 120) }));
  }
}

router.register('roles', async (interaction, route, { locale }) => {
  if (!interaction.guild) return null;
  if (route.action === 'configure') return interaction.showModal(buildModal(locale, interaction));
  if (route.action === 'modal') return handleModal(interaction, locale);
  if (route.action === 'confirm') return handleConfirm(interaction, locale, route.args[0]);
  if (route.action === 'cancel') {
    router.deleteSession(route.args[0]);
    return interaction.update({ ...ui.forEdit(ui.message(ui.notice('info', L(locale, 'panelTitle'), L(locale, 'cancelled')))), attachments: [] });
  }
  return null;
});

module.exports = { L, panelMessage, paymentMethods, parseColors, previewMessage, priceLines };

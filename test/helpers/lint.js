'use strict';

/**
 * Checks a message payload against Discord's Components V2 limits, so a card
 * that would be rejected by the API fails here instead of in a live server.
 */

const { MessageFlags, ComponentType } = require('discord.js');

const MAX_COMPONENTS = 40;
const MAX_TOP_LEVEL = 10;
const MAX_TEXT = 4000;
const URL_RE = /^(https?:\/\/|attachment:\/\/)/;

function toJSON(component) {
  return typeof component?.toJSON === 'function' ? component.toJSON() : component;
}

function lintPayload(payload) {
  const errors = [];
  const components = (payload.components ?? []).map(toJSON);
  const isV2 = Boolean((payload.flags ?? 0) & MessageFlags.IsComponentsV2);
  const customIds = new Set();
  const attachmentRefs = new Set();
  let count = 0;
  let text = 0;

  if (isV2 && (payload.content || payload.embeds?.length)) errors.push('V2 messages cannot have content or embeds');
  if (components.length > MAX_TOP_LEVEL) errors.push(`too many top-level components (${components.length})`);

  const checkUrl = (url, where) => {
    if (typeof url !== 'string' || !URL_RE.test(url)) errors.push(`${where}: invalid media URL ${url}`);
    else if (url.startsWith('attachment://')) attachmentRefs.add(url.slice('attachment://'.length));
  };

  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    count += 1;
    switch (node.type) {
      case ComponentType.Container:
        if (!node.components?.length) errors.push(`${path}: empty container`);
        break;
      case ComponentType.TextDisplay:
        if (!node.content) errors.push(`${path}: empty text display`);
        text += String(node.content ?? '').length;
        break;
      case ComponentType.Section:
        if (!node.components?.length || node.components.length > 3) errors.push(`${path}: section needs 1–3 text displays`);
        if (!node.accessory) errors.push(`${path}: section without accessory`);
        break;
      case ComponentType.Thumbnail:
        checkUrl(node.media?.url, path);
        break;
      case ComponentType.MediaGallery:
        if (!node.items?.length || node.items.length > 10) errors.push(`${path}: gallery needs 1–10 items`);
        for (const item of node.items ?? []) checkUrl(item.media?.url, path);
        break;
      case ComponentType.ActionRow:
        if (!node.components?.length || node.components.length > 5) errors.push(`${path}: action row needs 1–5 components`);
        break;
      case ComponentType.Button:
        if (node.style === 5) {
          if (!/^https?:\/\//.test(node.url ?? '')) errors.push(`${path}: link button without URL`);
        } else if (!node.custom_id) errors.push(`${path}: button without custom_id`);
        if (!node.label && !node.emoji) errors.push(`${path}: button without label or emoji`);
        if ((node.label ?? '').length > 80) errors.push(`${path}: button label too long`);
        break;
      case ComponentType.StringSelect: {
        const options = node.options ?? [];
        if (!options.length || options.length > 25) errors.push(`${path}: select needs 1–25 options (${options.length})`);
        const values = new Set();
        for (const option of options) {
          if (!option.label || option.label.length > 100) errors.push(`${path}: bad option label`);
          if ((option.description ?? '').length > 100) errors.push(`${path}: option description too long`);
          if (values.has(option.value)) errors.push(`${path}: duplicate option value ${option.value}`);
          values.add(option.value);
        }
        break;
      }
      default:
        break;
    }
    if (node.custom_id) {
      if (node.custom_id.length > 100) errors.push(`${path}: custom_id longer than 100`);
      if (customIds.has(node.custom_id)) errors.push(`${path}: duplicate custom_id ${node.custom_id}`);
      customIds.add(node.custom_id);
    }
    (node.components ?? []).forEach((child, i) => visit(child, `${path}.${i}`));
    if (node.accessory) visit(node.accessory, `${path}.accessory`);
  };

  components.forEach((component, i) => visit(component, `[${i}]`));
  if (count > MAX_COMPONENTS) errors.push(`too many components (${count} > ${MAX_COMPONENTS})`);
  if (text > MAX_TEXT) errors.push(`too much text (${text} > ${MAX_TEXT})`);

  const fileNames = new Set((payload.files ?? []).map(file => file.name ?? file.attachment?.name));
  for (const ref of attachmentRefs) {
    if (!fileNames.has(ref)) errors.push(`attachment://${ref} has no matching file`);
  }
  return { errors, count, text };
}

/** Throws with every problem found. */
function assertValid(payload, label = 'payload') {
  const { errors } = lintPayload(payload);
  if (errors.length) throw new Error(`${label} is not a valid Discord message:\n- ${errors.join('\n- ')}`);
  return payload;
}

/** Concatenated text of a payload (for content assertions). */
function textOf(payload) {
  const out = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.content) out.push(node.content);
    if (node.label) out.push(node.label);
    (node.components ?? []).forEach(visit);
    (node.options ?? []).forEach(o => out.push(o.label));
    if (node.accessory) visit(node.accessory);
  };
  (payload.components ?? []).map(toJSON).forEach(visit);
  return out.join('\n');
}

/** All custom IDs in a payload. */
function customIdsOf(payload) {
  const out = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.custom_id) out.push(node.custom_id);
    (node.components ?? []).forEach(visit);
    if (node.accessory) visit(node.accessory);
  };
  (payload.components ?? []).map(toJSON).forEach(visit);
  return out;
}

module.exports = { lintPayload, assertValid, textOf, customIdsOf };

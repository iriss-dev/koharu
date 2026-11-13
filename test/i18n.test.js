'use strict';

process.env.DATABASE_PATH = ':memory:';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const registry = require('../src/core/registry');
const i18n = require('../src/core/i18n');
const emojis = require('../src/core/emojis');

// Loading every command registers every string namespace.
const { commands, aliases, slashData } = registry.get();

function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

const placeholders = value => new Set([...String(Array.isArray(value) ? value.join(' ') : value).matchAll(/\{(\w+)\}/g)].map(m => m[1]));

describe('translations', () => {
  const es = flatten(i18n._tables.es);
  const en = flatten(i18n._tables.en);

  test('Spanish and English have exactly the same keys', () => {
    assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  });

  // Spanish leaves the noun out on purpose: "el primer {noun}" breaks gender agreement.
  const INTENTIONAL = new Set(['social.countFirst']);

  test('both languages use the same {variables}', () => {
    for (const key of Object.keys(es)) {
      if (INTENTIONAL.has(key)) continue;
      assert.deepEqual(placeholders(es[key]), placeholders(en[key]), `placeholders differ for ${key}`);
    }
  });

  test('every {e:emoji} token exists in the emoji set', () => {
    for (const [key, value] of Object.entries({ ...es, ...en })) {
      for (const match of String(Array.isArray(value) ? value.join(' ') : value).matchAll(/\{e:([a-z_]+)\}/g)) {
        assert.ok(emojis.has(match[1]), `${key} uses unknown emoji ${match[1]}`);
      }
    }
  });

  test('locale resolution prefers the server setting, then the user', () => {
    assert.equal(i18n.resolve({ guildSetting: 'en', userLocale: 'es-ES' }), 'en');
    assert.equal(i18n.resolve({ userLocale: 'es-419', guildLocale: 'en-US' }), 'es');
    assert.equal(i18n.resolve({ userLocale: 'pt-BR', guildLocale: 'en-GB', fallback: 'es' }), 'en');
    assert.equal(i18n.resolve({ userLocale: 'ja', fallback: 'es' }), 'es');
  });

  test('t() formats variables and falls back to the key', () => {
    assert.equal(i18n.t('es', 'common.page', { page: 2, pages: 5 }), '2 / 5');
    assert.equal(i18n.t('es', 'nope.missing'), 'nope.missing');
  });
});

describe('slash commands respect Discord limits', () => {
  test('at most 100 global commands', () => {
    assert.ok(slashData.length <= 100);
    assert.equal(slashData.length, commands.size);
  });

  test('names, descriptions, options and choices fit', () => {
    const NAME = /^[-_\p{L}\p{N}]{1,32}$/u;
    const visit = (option, path) => {
      assert.match(option.name, NAME, path);
      assert.ok(option.description.length >= 1 && option.description.length <= 100, `${path} description length`);
      for (const [loc, name] of Object.entries(option.name_localizations ?? {})) assert.match(name, NAME, `${path} ${loc}`);
      for (const desc of Object.values(option.description_localizations ?? {})) assert.ok(desc.length <= 100, `${path} localized description`);
      assert.ok((option.choices ?? []).length <= 25, `${path} has too many choices`);
      for (const c of option.choices ?? []) {
        assert.ok(c.name.length <= 100, `${path} choice ${c.name}`);
        for (const n of Object.values(c.name_localizations ?? {})) assert.ok(n.length <= 100, `${path} choice ${n}`);
      }
      assert.ok((option.options ?? []).length <= 25, `${path} has too many options`);
      // Required options must come before optional ones.
      let seenOptional = false;
      for (const child of option.options ?? []) {
        if (child.type <= 2) continue;
        if (!child.required) seenOptional = true;
        else assert.ok(!seenOptional, `${path}.${child.name}: required option after optional`);
      }
      for (const child of option.options ?? []) visit(child, `${path}.${child.name}`);
    };
    for (const command of slashData) {
      visit(command, `/${command.name}`);
      // Discord caps the combined text of a command and its options at 4000 characters.
      const size = JSON.stringify(command, ['name', 'description', 'options', 'choices', 'value']).length;
      assert.ok(size < 8000, `/${command.name} is very large (${size})`);
    }
  });

  test('every command has a category, an emoji and a Spanish name', () => {
    for (const command of commands.values()) {
      assert.ok(registry.CATEGORIES[command.category], command.data.name);
      assert.ok(emojis.has(command.emoji), `${command.data.name} emoji ${command.emoji}`);
      assert.ok(registry.displayName(command, 'es'));
    }
  });

  test('prefix aliases are unique and lowercase', () => {
    for (const alias of aliases.keys()) assert.equal(alias, alias.toLowerCase());
    assert.ok(aliases.get('abrazo').preset, 'action aliases carry a preset');
    assert.equal(aliases.get('ayuda').name, 'help');
    assert.equal(aliases.get('b').name, 'balance', '"b" no longer collides with ban');
  });
});

describe('emoji set', () => {
  const fs = require('fs');

  test('every emoji in the manifest has artwork, small enough for Discord', () => {
    for (const name of Object.keys(emojis.MANIFEST)) {
      const file = emojis.fileFor(name);
      assert.ok(fs.existsSync(file), `missing ${file}`);
      assert.ok(fs.statSync(file).size < 256 * 1024, `${name} is over 256 KB`);
      assert.ok(`${emojis.PREFIX}${name}`.length <= 32 && /^\w+$/.test(name));
    }
  });

  test('falls back to Unicode until synced, then uses the application emoji', () => {
    assert.equal(emojis.e('sakura'), '🌸');
    emojis._setResolved('sakura', { id: '123', name: 'kh_sakura', animated: false });
    assert.equal(emojis.e('sakura'), '<:kh_sakura:123>');
    assert.deepEqual(emojis.component('sakura'), { id: '123', name: 'kh_sakura', animated: false });
    emojis._setResolved('sakura', null);
  });
});

# Contributing to Koharu

Thank you for wanting to make Koharu better. Pull requests, ideas and bug reports are all welcome.

## Setup

```bash
git clone https://github.com/<your-username>/koharu.git
cd koharu
npm install
npm test
```

`npm test` runs every command end to end against fake Discord objects and recorded API responses, so it needs no token and no network.

## How the code is organised

| Path | What lives there |
| --- | --- |
| `src/commands/<category>/` | One file per slash command. Each exports `data`, `category`, `emoji`, `run(ctx)` and, optionally, `prefix` and `autocomplete`. |
| `src/features/` | The logic and cards behind each area (anime, fashion, deals, economy…), plus their button and menu handlers. |
| `src/core/` | Shared plumbing: the card kit (`ui.js`), strings (`i18n.js`), component routing (`router.js`), the command context, emojis and the HTTP client. |
| `src/services/` | Thin clients for AniList, CheapShark and GamerPower, plus `kawaii.js`: pooled anime GIFs and pictures from nekos.best and waifu.pics, picked by mood (`kawaii.mood('warn')`). |
| `scripts/emojis/` | The emoji set as SVG and the script that renders it to `assets/emojis/*.png`. |
| `scripts/preview/` | Renders real replies in a Discord-like page and screenshots them to `docs/preview/`. |

## Guidelines

- **Write the command once.** `run(ctx)` serves both `/command` and the text prefix; read options with `ctx.opt.*`.
- **Every string in both languages.** Register strings with `i18n.register(namespace, { es, en })`. The test suite fails if a key or a `{variable}` exists in only one language.
- **Pictures come from a mood.** Decorative images are small thumbnails from `kawaii.mood()` / `kawaii.moodNow()`, not big local files; keep galleries for the content itself (an interaction GIF, a cover).
- **Build replies with `ui.card()`.** It keeps the look consistent, and the test suite checks every reply against Discord's limits (40 components, 4000 characters, 100-character custom IDs).
- **Buttons go through the router.** Use `router.encode(feature, action, ownerId, ...args)`; ownership is enforced for you.
- **Money moves atomically.** Use `db.spendCoins`, `db.transfer` and friends, never read-then-write.
- **Tone.** Warm, clear and never pushy. No gendered assumptions about the reader.

## Changing the emojis

Edit `scripts/emojis/designs.js`, then:

```bash
npx playwright install chromium   # once
npm run emojis:render -- --sheet emoji-sheet.png
```

Running bots notice the new artwork on their next start and replace only the emojis that changed.

## Pull request checklist

- [ ] `npm test` passes.
- [ ] New strings exist in Spanish and English.
- [ ] No tokens, `.env` files or databases are committed.

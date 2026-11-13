'use strict';

/**
 * Realistic API responses (shapes taken from each API's documentation) and a
 * fetch stand-in that routes requests to them.
 */

const frieren = {
  id: 154587, idMal: 52991, type: 'ANIME', format: 'TV', status: 'FINISHED', episodes: 28, duration: 24, chapters: null, volumes: null,
  season: 'FALL', seasonYear: 2023, averageScore: 91, meanScore: 91, popularity: 512345, favourites: 61234,
  genres: ['Adventure', 'Drama', 'Fantasy'], isAdult: false, siteUrl: 'https://anilist.co/anime/154587',
  bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg', source: 'MANGA', countryOfOrigin: 'JP',
  title: { romaji: 'Sousou no Frieren', english: "Frieren: Beyond Journey's End", native: '葬送のフリーレン' },
  coverImage: { extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg', large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587.jpg', color: '#d6e4a1' },
  description: 'The adventure is over but life goes on for an elf mage just beginning to learn what living is all about.<br><br>Elf mage <i>Frieren</i> and her courageous fellow adventurers have defeated the Demon King. ~!She outlives them all.!~<br>(Source: Crunchyroll)',
  startDate: { year: 2023, month: 9, day: 29 }, endDate: { year: 2024, month: 3, day: 22 },
  studios: { nodes: [{ name: 'Madhouse', siteUrl: 'https://anilist.co/studio/11' }] },
  trailer: { id: 'qgQ-kv5DS4I', site: 'youtube' },
  nextAiringEpisode: null,
};

const berserk = {
  ...frieren, id: 30002, idMal: 2, type: 'MANGA', format: 'MANGA', status: 'RELEASING', episodes: null, duration: null, chapters: 380, volumes: 42,
  season: null, seasonYear: null, title: { romaji: 'Berserk', english: 'Berserk', native: 'ベルセルク' }, trailer: null, bannerImage: null,
  siteUrl: 'https://anilist.co/manga/30002', genres: ['Action', 'Drama', 'Fantasy', 'Horror'],
};

const many = n => Array.from({ length: n }, (_, i) => ({ ...frieren, id: 1000 + i, title: { romaji: `Anime ${i + 1}`, english: null, native: null } }));

const character = {
  id: 176754, name: { full: 'Frieren', native: 'フリーレン', alternative: ['Frieren the Slayer'] },
  image: { large: 'https://s4.anilist.co/file/anilistcdn/character/large/b176754.png' },
  description: 'An elf mage who was part of the hero party. ~!She later becomes a teacher.!~', gender: 'Female', age: '1000+', favourites: 40213,
  siteUrl: 'https://anilist.co/character/176754', dateOfBirth: { month: null, day: null },
  media: { nodes: [{ id: 154587, type: 'ANIME', title: frieren.title, siteUrl: frieren.siteUrl, isAdult: false }] },
};

const deals = Array.from({ length: 12 }, (_, i) => ({
  internalName: `GAME${i}`, title: `Cozy Game ${i + 1}`, dealID: `deal%2B${i}`, storeID: i % 2 ? '1' : '7', gameID: String(500 + i),
  salePrice: (4.99 + i).toFixed(2), normalPrice: '29.99', isOnSale: '1', savings: '83.36', metacriticScore: i % 3 ? '85' : '0',
  steamRatingText: 'Very Positive', steamRatingPercent: '92', steamRatingCount: '1500', steamAppID: '1000', releaseDate: 1600000000,
  lastChange: 1700000000, dealRating: '9.5', thumb: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${1000 + i}/capsule_sm_120.jpg`,
}));

const stores = [
  { storeID: '1', storeName: 'Steam', isActive: 1, images: { icon: '/img/stores/icons/0.png' } },
  { storeID: '7', storeName: 'GOG', isActive: 1, images: { icon: '/img/stores/icons/6.png' } },
  { storeID: '99', storeName: 'Closed Store', isActive: 0, images: {} },
];

const games = [{ gameID: '612', steamAppID: '1145360', cheapest: '9.99', cheapestDealID: 'abc', external: 'Hades', internalName: 'HADES', thumb: 'https://example.com/hades.jpg' }];

const gameDetail = {
  info: { title: 'Hades', steamAppID: '1145360', thumb: 'https://example.com/hades.jpg' },
  cheapestPriceEver: { price: '7.99', date: 1700000000 },
  deals: [
    { storeID: '7', dealID: 'gog1', price: '12.49', retailPrice: '24.99', savings: '50.02' },
    { storeID: '1', dealID: 'steam1', price: '9.99', retailPrice: '24.99', savings: '60.02' },
  ],
};

const giveaways = Array.from({ length: 6 }, (_, i) => ({
  id: 3000 + i, title: `Free Game ${i + 1} Giveaway`, worth: i % 2 ? '$19.99' : 'N/A',
  thumbnail: `https://www.gamerpower.com/offers/1/${3000 + i}.jpg`, image: `https://www.gamerpower.com/offers/1b/${3000 + i}.jpg`,
  description: 'Grab it for free for a limited time!', instructions: '1. Click the button\n2. Claim', open_giveaway_url: `https://www.gamerpower.com/open/free-game-${i}`,
  published_date: '2026-11-10 10:00:00', type: 'Game', platforms: 'PC, Epic Games Store', end_date: i % 3 ? '2026-11-20 23:59:00' : 'N/A',
  users: 1200, status: 'Active', gamerpower_url: `https://www.gamerpower.com/free-game-${i}`,
}));

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, async text() { return JSON.stringify(data); } };
}

/** fetch stand-in. `log` collects every request for assertions. */
function mockFetch(log = []) {
  return async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    log.push({ url, body });
    if (url.startsWith('https://graphql.anilist.co')) {
      const q = body.query;
      if (q.includes('airingSchedules')) return response({ data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: [{ episode: 5, airingAt: 1794600000, media: frieren }, { episode: 2, airingAt: 1794603600, media: { ...frieren, id: 2, isAdult: true } }] } } });
      if (q.includes('recommendations')) return response({ data: { Media: { id: frieren.id, title: frieren.title, recommendations: { nodes: many(7).map(m => ({ rating: 10, mediaRecommendation: m })) } } } });
      if (q.includes('voiceActors')) return response({ data: { Media: { characters: { edges: [{ role: 'MAIN', node: character, voiceActors: [{ name: { full: 'Atsumi Tanezaki' } }] }] } } } });
      if (q.includes('Character(id')) return response({ data: { Character: character } });
      if (q.includes('Character(search')) return response({ data: { Character: body.variables.search === 'nobody' ? null : character } });
      if (q.includes('characters(search')) return response({ data: { Page: { characters: [character] } } });
      if (q.includes('Media(id')) return body.variables.id === 404 ? response({ errors: [{ message: 'Not Found.', status: 404 }], data: { Media: null } }, 404) : response({ data: { Media: body.variables.id === berserk.id ? berserk : frieren } });
      if (q.includes('Media(search')) return response({ data: { Media: body.variables.search === 'nothing at all' ? null : body.variables.type === 'MANGA' ? berserk : frieren } });
      if (q.includes('Page(')) {
        const perPage = body.variables.perPage ?? 10;
        return response({ data: { Page: { pageInfo: { total: 300, currentPage: 1, lastPage: 30, hasNextPage: true }, media: many(Math.min(perPage, 25)) } } });
      }
      return response({ errors: [{ message: 'unknown query' }] }, 400);
    }
    if (url.includes('cheapshark.com/api/1.0/stores')) return response(stores);
    if (url.includes('cheapshark.com/api/1.0/deals')) return response(url.includes('title=zzz') ? [] : deals);
    if (url.includes('cheapshark.com/api/1.0/games?id=')) return response(gameDetail);
    if (url.includes('cheapshark.com/api/1.0/games?')) return response(games);
    if (url.includes('gamerpower.com/api/giveaways')) return response(url.includes('platform=vr') ? { status: 0, status_message: 'No active giveaways available at the moment.' } : giveaways, url.includes('platform=vr') ? 201 : 200);
    if (url.startsWith('https://nekos.best/api/v2/')) return response({ results: [{ anime_name: 'Kanojo, Okarishimasu', url: 'https://nekos.best/api/v2/hug/0001.gif' }] });
    return response({ error: 'not mocked' }, 404);
  };
}

module.exports = { frieren, berserk, character, deals, stores, games, gameDetail, giveaways, mockFetch, response, many };

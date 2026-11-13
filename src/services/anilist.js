'use strict';

/**
 * AniList GraphQL client (https://anilist.gitbook.io/anilist-apiv2-docs).
 * Free, no API key. Adult content is always filtered out.
 */

const { getJson, HttpError } = require('../core/http');

const ENDPOINT = 'https://graphql.anilist.co';

const LIGHT = `
  id idMal type format status episodes chapters seasonYear averageScore popularity isAdult siteUrl
  title { romaji english native }
  coverImage { large color }
  startDate { year }
`;

const FULL = `
  id idMal type format status episodes duration chapters volumes season seasonYear
  averageScore meanScore popularity favourites genres isAdult siteUrl bannerImage source countryOfOrigin
  title { romaji english native }
  coverImage { extraLarge large color }
  description(asHtml: false)
  startDate { year month day }
  endDate { year month day }
  studios(isMain: true) { nodes { name siteUrl } }
  trailer { id site }
  nextAiringEpisode { episode airingAt }
`;

async function gql(query, variables, { ttl = 10 * 60 * 1000 } = {}) {
  try {
    const res = await getJson(ENDPOINT, { method: 'POST', body: { query, variables }, ttl, timeout: 9000 });
    return res?.data ?? null;
  } catch (err) {
    // AniList answers 404 with an errors[] body for unknown IDs.
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

/** Current AniList season for a date (WINTER = Jan–Mar … FALL = Oct–Dec). */
function currentSeason(date = new Date()) {
  const month = date.getUTCMonth();
  const season = ['WINTER', 'WINTER', 'WINTER', 'SPRING', 'SPRING', 'SPRING', 'SUMMER', 'SUMMER', 'SUMMER', 'FALL', 'FALL', 'FALL'][month];
  return { season, year: date.getUTCFullYear() };
}

const VARIABLE_TYPES = {
  search: 'String', type: 'MediaType', season: 'MediaSeason', seasonYear: 'Int', genre: 'String', sort: '[MediaSort]', minScore: 'Int',
};

/**
 * Builds a paged media query that declares exactly the variables it uses
 * (GraphQL rejects declared-but-unused variables).
 * @param {string} fields
 * @param {string[]} filters e.g. ['type: $type', 'isAdult: false']
 */
function pageQuery(fields, filters) {
  const used = Object.keys(VARIABLE_TYPES).filter(name => filters.some(filter => filter.includes(`$${name}`)));
  const decls = ['$page: Int', '$perPage: Int', ...used.map(name => `$${name}: ${VARIABLE_TYPES[name]}`)].join(', ');
  return `
  query (${decls}) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage }
      media(${filters.join(', ')}) { ${fields} }
    }
  }`;
}

/** Title search, used by autocomplete and /search. */
async function search(type, query, { perPage = 10 } = {}) {
  const data = await gql(
    pageQuery(LIGHT, ['search: $search', 'type: $type', 'isAdult: false', 'sort: [SEARCH_MATCH, POPULARITY_DESC]']),
    { search: query, type, page: 1, perPage },
    { ttl: 30 * 60 * 1000 },
  );
  return data?.Page?.media ?? [];
}

async function media(id) {
  const data = await gql(`query ($id: Int) { Media(id: $id, isAdult: false) { ${FULL} } }`, { id: Number(id) });
  return data?.Media ?? null;
}

/** Best match for free text (when the user did not pick an autocomplete entry). */
async function findOne(type, query) {
  const data = await gql(`query ($search: String, $type: MediaType) { Media(search: $search, type: $type, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) { ${FULL} } }`, { search: query, type });
  return data?.Media ?? null;
}

async function browse({ type = 'ANIME', sort = ['TRENDING_DESC'], season, seasonYear, genre, page = 1, perPage = 25, minScore } = {}) {
  const filters = ['type: $type', 'isAdult: false', 'sort: $sort'];
  if (season) filters.push('season: $season', 'seasonYear: $seasonYear');
  if (genre) filters.push('genre: $genre');
  if (minScore) filters.push('averageScore_greater: $minScore');
  const variables = { type, sort, page, perPage };
  if (season) Object.assign(variables, { season, seasonYear });
  if (genre) variables.genre = genre;
  if (minScore) variables.minScore = minScore;
  const data = await gql(pageQuery(FULL, filters), variables);
  return { items: data?.Page?.media ?? [], pageInfo: data?.Page?.pageInfo ?? { total: 0, lastPage: 1 } };
}

/** Episodes airing between two unix timestamps (sorted by time). */
async function airing(from, to, { page = 1, perPage = 50 } = {}) {
  const data = await gql(`
    query ($from: Int, $to: Int, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
          episode airingAt
          media { ${LIGHT} }
        }
      }
    }`, { from, to, page, perPage }, { ttl: 5 * 60 * 1000 });
  return (data?.Page?.airingSchedules ?? []).filter(entry => entry.media && !entry.media.isAdult);
}

async function recommendations(id, { perPage = 10 } = {}) {
  const data = await gql(`
    query ($id: Int, $perPage: Int) {
      Media(id: $id) {
        id title { romaji english }
        recommendations(sort: [RATING_DESC], perPage: $perPage) {
          nodes { rating mediaRecommendation { ${FULL} } }
        }
      }
    }`, { id: Number(id), perPage });
  const nodes = data?.Media?.recommendations?.nodes ?? [];
  return nodes.map(node => node.mediaRecommendation).filter(item => item && !item.isAdult);
}

async function characters(mediaId, { perPage = 8 } = {}) {
  const data = await gql(`
    query ($id: Int, $perPage: Int) {
      Media(id: $id) {
        characters(sort: [ROLE, FAVOURITES_DESC], perPage: $perPage) {
          edges { role node { id name { full native } image { large } favourites siteUrl } voiceActors(language: JAPANESE) { name { full } } }
        }
      }
    }`, { id: Number(mediaId), perPage });
  return data?.Media?.characters?.edges ?? [];
}

const CHARACTER = `
  id name { full native alternative } image { large } description(asHtml: false) gender age favourites siteUrl
  dateOfBirth { month day }
  media(perPage: 4, sort: [POPULARITY_DESC]) { nodes { id type title { romaji english } siteUrl isAdult } }
`;

async function searchCharacters(query, { perPage = 10 } = {}) {
  const data = await gql(`
    query ($search: String, $perPage: Int) {
      Page(perPage: $perPage) { characters(search: $search, sort: [SEARCH_MATCH, FAVOURITES_DESC]) { id name { full native } image { large } favourites } }
    }`, { search: query, perPage }, { ttl: 30 * 60 * 1000 });
  return data?.Page?.characters ?? [];
}

async function character(id) {
  const data = await gql(`query ($id: Int) { Character(id: $id) { ${CHARACTER} } }`, { id: Number(id) });
  return data?.Character ?? null;
}

async function findCharacter(query) {
  const data = await gql(`query ($search: String) { Character(search: $search, sort: [SEARCH_MATCH, FAVOURITES_DESC]) { ${CHARACTER} } }`, { search: query });
  return data?.Character ?? null;
}

/** A random well-rated title, optionally of one genre. */
async function random({ type = 'ANIME', genre } = {}, random = Math.random) {
  const first = await browse({ type, genre, sort: ['POPULARITY_DESC'], page: 1, perPage: 1, minScore: 65 });
  // Stay within the most popular 500 so picks are watchable, not obscure.
  const pool = Math.min(first.pageInfo.total || 1, 500);
  const index = Math.floor(random() * pool);
  const perPage = 25;
  const page = Math.floor(index / perPage) + 1;
  const { items } = await browse({ type, genre, sort: ['POPULARITY_DESC'], page, perPage, minScore: 65 });
  return items[index % perPage] ?? items[0] ?? first.items[0] ?? null;
}

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
];

/** Preferred display title. */
function titleOf(item) {
  return item?.title?.english || item?.title?.romaji || item?.title?.native || '—';
}

module.exports = {
  ENDPOINT, GENRES, currentSeason, search, media, findOne, browse, airing, recommendations,
  characters, searchCharacters, character, findCharacter, random, titleOf,
};

'use strict';

/**
 * CheapShark (https://apidocs.cheapshark.com): PC game prices across Steam, GOG,
 * Humble, Fanatical, Epic and ~30 other stores. Free, no key. Links go through
 * CheapShark's redirect, as their terms ask.
 */

const { getJson } = require('../core/http');

const BASE = 'https://www.cheapshark.com/api/1.0';
const SITE = 'https://www.cheapshark.com';

const num = value => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const dealUrl = dealId => `${SITE}/redirect?dealID=${encodeURIComponent(dealId)}`;

async function stores() {
  const data = await getJson(`${BASE}/stores`, { ttl: 24 * 60 * 60 * 1000 });
  const map = new Map();
  for (const store of Array.isArray(data) ? data : []) {
    if (!store.isActive) continue;
    map.set(String(store.storeID), {
      id: String(store.storeID),
      name: store.storeName,
      icon: store.images?.icon ? `${SITE}${store.images.icon}` : null,
    });
  }
  return map;
}

function normalizeDeal(raw) {
  return {
    dealId: raw.dealID,
    gameId: String(raw.gameID),
    storeId: String(raw.storeID),
    title: raw.title,
    salePrice: num(raw.salePrice),
    normalPrice: num(raw.normalPrice),
    savings: Math.round(num(raw.savings) ?? 0),
    metacritic: Number(raw.metacriticScore) || null,
    steamRating: raw.steamRatingText || null,
    steamPercent: Number(raw.steamRatingPercent) || null,
    dealRating: num(raw.dealRating),
    thumb: raw.thumb || null,
    steamAppId: raw.steamAppID || null,
    url: dealUrl(raw.dealID),
  };
}

/**
 * @param {{ title?: string, storeId?: string, upperPrice?: number, sortBy?: string, pageSize?: number }} [options]
 */
async function deals({ title, storeId, upperPrice, sortBy, pageSize = 30 } = {}) {
  const params = new URLSearchParams({ pageSize: String(pageSize), onSale: '1' });
  if (title) {
    params.set('title', title);
    params.set('sortBy', sortBy || 'Price');
  } else {
    params.set('sortBy', sortBy || 'Deal Rating');
    params.set('AAA', '0');
  }
  if (storeId) params.set('storeID', storeId);
  if (upperPrice !== undefined && upperPrice !== null) params.set('upperPrice', String(upperPrice));
  const data = await getJson(`${BASE}/deals?${params}`, { ttl: 15 * 60 * 1000 });
  return (Array.isArray(data) ? data : []).map(normalizeDeal);
}

async function searchGames(title, { limit = 10 } = {}) {
  const params = new URLSearchParams({ title, limit: String(limit) });
  const data = await getJson(`${BASE}/games?${params}`, { ttl: 30 * 60 * 1000 });
  return (Array.isArray(data) ? data : []).map(game => ({
    gameId: String(game.gameID),
    title: game.external,
    cheapest: num(game.cheapest),
    thumb: game.thumb || null,
    dealUrl: game.cheapestDealID ? dealUrl(game.cheapestDealID) : null,
  }));
}

/** Current prices of one game across stores, cheapest first. */
async function game(gameId) {
  const data = await getJson(`${BASE}/games?id=${encodeURIComponent(gameId)}`, { ttl: 10 * 60 * 1000 });
  if (!data?.info) return null;
  const list = (data.deals ?? [])
    .map(deal => ({
      storeId: String(deal.storeID),
      dealId: deal.dealID,
      price: num(deal.price),
      retailPrice: num(deal.retailPrice),
      savings: Math.round(num(deal.savings) ?? 0),
      url: dealUrl(deal.dealID),
    }))
    .sort((a, b) => a.price - b.price);
  return {
    gameId: String(gameId),
    title: data.info.title,
    thumb: data.info.thumb || null,
    lowestEver: num(data.cheapestPriceEver?.price),
    lowestEverDate: data.cheapestPriceEver?.date ?? null,
    deals: list,
  };
}

module.exports = { BASE, stores, deals, searchGames, game, normalizeDeal, dealUrl };

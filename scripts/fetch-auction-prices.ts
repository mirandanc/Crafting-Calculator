/**
 * Downloads one WoW Forever auction house from the Blizzard API, works out a market value per item,
 * and writes auction-prices.json. The GitHub workflow .github/workflows/auction-prices.yml runs it twice
 * a day and stores the file in Cloudflare KV.
 *
 * Run locally with `npm run fetch:auction-prices` (reads BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET
 * from .env), or `npm run auction:houses` to list the Alliance houses.
 *
 * Only type imports from src/ (erased when Node strips types), so Node runs this file directly.
 */
import { rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuctionHouse, AuctionPriceList } from '@/prices/auctionPrices';

/** Blizzard's `time_left`: how long a listing has before it expires. */
export type TimeLeftBand = 'SHORT' | 'MEDIUM' | 'LONG' | 'VERY_LONG';

export type Listing = {
  /** Blizzard's auction id; the same listing keeps it from one snapshot to the next. */
  id: number;
  itemId: number;
  /** Copper per unit. */
  unitPrice: number;
  quantity: number;
  band: TimeLeftBand;
};

export type BlizzardClientDeps = {
  fetch: typeof globalThis.fetch;
};

export type BlizzardClient = {
  get(path: string): Promise<unknown>;
};

type UnknownRecord = Record<string, unknown>;

type ListingBase = {
  id: number;
  itemId: number;
  quantity: number;
  band: TimeLeftBand;
};

type HouseIndexEntry = {
  id: number;
  name: string;
};

type HouseIndex = {
  auctions: HouseIndexEntry[];
};

/** Share of an item's quantity for sale that its price is averaged over, cheapest listings first. */
const MARKET_SHARE = 0.15;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** In the order the history file stores them (a band is saved as its index). */
const BANDS: TimeLeftBand[] = ['SHORT', 'MEDIUM', 'LONG', 'VERY_LONG'];
/**
 * The least time a listing in each band still has. Blizzard documents VERY_LONG as over 12 h; 8 h is the
 * safer floor. A listing that vanishes sooner than its band allows was bought (or cancelled), not expired.
 */
const BAND_MINIMUM_MS: Record<TimeLeftBand, number> = { SHORT: 0, MEDIUM: 30 * MINUTE_MS, LONG: 2 * HOUR_MS, VERY_LONG: 8 * HOUR_MS };
/**
 * Mirrors GOLD_CAP_COPPER in src/money/money.ts (9 999 999g 99s 99c), the most the page accepts.
 * Kept as a copy because this script may import only types from src/.
 */
const GOLD_CAP_COPPER = 99_999_999_999;
/** The market the page prices from: US, ruleset 1 (PvP), Alliance house 110. The ruleset in the path doesn't filter. */
const HOUSE: AuctionHouse = { ruleset: 1, id: 110, name: 'Alliance Auction House' };
const TOKEN_URL = 'https://oauth.battle.net/token';
const API = 'https://us.api.blizzard.com';
const QUERY = 'namespace=dynamic-forever-us&locale=en_US';
/** House 110 lists about 5 000 distinct items; far fewer means a broken or partial answer. */
const MIN_ITEMS = 500;
/** A stalled Blizzard answer fails after this long instead of eating the workflow's time budget. */
const REQUEST_TIMEOUT_MS = 60_000;
/** Relative to the working directory, which is the repo root under npm scripts and the workflow. */
const OUTPUT_FILE = resolve('auction-prices.json');

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function listingsOf(body: unknown, name: string, required: boolean): unknown[] {
  if (!isRecord(body)) throw new Error(`The ${name} answer is not an object`);
  if (body.auctions === undefined && !required) return [];
  if (!Array.isArray(body.auctions)) throw new Error(`The ${name} answer has no auctions list`);
  return body.auctions;
}

/** An unknown or missing band reads as SHORT, which never counts as a sale. */
function bandOf(value: unknown): TimeLeftBand {
  return BANDS.find((band) => band === value) ?? 'SHORT';
}

export function bandMinimumMs(band: TimeLeftBand): number {
  return BAND_MINIMUM_MS[band];
}

function listingBase(raw: UnknownRecord): ListingBase {
  const item = raw.item;
  if (!isPositiveInteger(raw.id) || !isRecord(item) || !isPositiveInteger(item.id) || !isPositiveInteger(raw.quantity)) {
    throw new Error(`Unexpected listing: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  return { id: raw.id, itemId: item.id, quantity: raw.quantity, band: bandOf(raw.time_left) };
}

/**
 * Flattens a house answer (regular auctions, `buyout` per auction) and its commodities answer
 * (`unit_price` per unit; the list is also named `auctions`) into per-unit listings. Bid-only
 * auctions are skipped. An empty house has no `auctions` field at all; an empty commodities answer
 * is not allowed to miss it. Each listing keeps its auction id and time-left band, which the sales
 * estimate compares between runs.
 */
export function unitListings(house: unknown, commodities: unknown): Listing[] {
  const listings: Listing[] = [];
  for (const raw of listingsOf(house, 'auctions', false)) {
    if (!isRecord(raw)) throw new Error('Unexpected listing in auctions');
    const base = listingBase(raw);
    if (raw.buyout === undefined) continue;
    if (!isPositiveInteger(raw.buyout)) throw new Error(`Unexpected listing buyout for item ${base.itemId}`);
    listings.push({ ...base, unitPrice: raw.buyout / base.quantity });
  }
  for (const raw of listingsOf(commodities, 'commodities', true)) {
    if (!isRecord(raw)) throw new Error('Unexpected listing in commodities');
    const base = listingBase(raw);
    if (!isPositiveInteger(raw.unit_price)) throw new Error(`Unexpected listing unit_price for item ${base.itemId}`);
    listings.push({ ...base, unitPrice: raw.unit_price });
  }
  return listings;
}

/**
 * Quantity-weighted average of the cheapest listings that reach MARKET_SHARE of the quantity for sale.
 * Kept within [1, GOLD_CAP_COPPER] copper, so the page never drops a listed item as "Not on AH".
 */
export function marketValue(listings: Listing[]): number {
  if (listings.length === 0) throw new Error('No listings to price');
  const sorted = [...listings].sort((a, b) => a.unitPrice - b.unitPrice);
  const total = sorted.reduce((sum, listing) => sum + listing.quantity, 0);
  const target = total * MARKET_SHARE;
  let taken = 0;
  let spent = 0;
  for (const listing of sorted) {
    taken += listing.quantity;
    spent += listing.unitPrice * listing.quantity;
    if (taken >= target) break;
  }
  return Math.min(GOLD_CAP_COPPER, Math.max(1, Math.round(spent / taken)));
}

/** One market value per item id, in copper. */
export function marketValues(listings: Listing[]): Record<string, number> {
  const byItem = new Map<number, Listing[]>();
  for (const listing of listings) {
    const group = byItem.get(listing.itemId);
    if (group === undefined) byItem.set(listing.itemId, [listing]);
    else group.push(listing);
  }
  const prices: Record<string, number> = {};
  for (const [itemId, group] of byItem) prices[String(itemId)] = marketValue(group);
  return prices;
}

export function createBlizzardClient(clientId: string, clientSecret: string, deps: BlizzardClientDeps): BlizzardClient {
  let token: Promise<string> | null = null;

  const requestToken = async (): Promise<string> => {
    const response = await deps.fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Blizzard token request failed: ${response.status}`);
    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body.access_token !== 'string' || body.access_token === '') {
      throw new Error('Blizzard token answer has no access token');
    }
    return body.access_token;
  };

  return {
    async get(path) {
      token ??= requestToken();
      const response = await deps.fetch(`${API}${path}?${QUERY}`, {
        headers: { Authorization: `Bearer ${await token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`${path} answered ${response.status}`);
      return response.json();
    },
  };
}

/** Total quantity for sale per item id: the ranking hides results with too few listed. */
export function totalQuantities(listings: Listing[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const listing of listings) {
    const key = String(listing.itemId);
    quantities[key] = (quantities[key] ?? 0) + listing.quantity;
  }
  return quantities;
}

export function buildPriceList(listings: Listing[], house: AuctionHouse, now: Date): AuctionPriceList {
  return { updatedAt: now.toISOString(), house, prices: marketValues(listings), quantities: totalQuantities(listings) };
}

export function checkPriceList(list: AuctionPriceList): void {
  const count = Object.keys(list.prices).length;
  if (count < MIN_ITEMS) throw new Error(`Only ${count} items priced (expected at least ${MIN_ITEMS}); not saving`);
}

async function listHouses(client: BlizzardClient): Promise<void> {
  const index = (await client.get(`/data/wow/ruleset/${HOUSE.ruleset}/auctions/`)) as HouseIndex;
  for (const house of index.auctions.filter((entry) => entry.name.startsWith('Alliance'))) {
    const body = await client.get(`/data/wow/ruleset/${HOUSE.ruleset}/auctions/${house.id}/commodities`);
    const count = isRecord(body) && Array.isArray(body.auctions) ? body.auctions.length : 0;
    console.log(`${house.id}  ${house.name}  ${count} commodity listings${house.id === HOUSE.id ? '  ← used' : ''}`);
  }
}

async function main(): Promise<void> {
  const clientId = process.env.BLIZZARD_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET?.trim() ?? '';
  if (clientId === '' || clientSecret === '') {
    console.error('BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET are missing. Put them in .env (see .env.example).');
    process.exit(1);
  }
  const client = createBlizzardClient(clientId, clientSecret, { fetch });
  if (process.argv.includes('--houses')) {
    await listHouses(client);
    return;
  }

  const base = `/data/wow/ruleset/${HOUSE.ruleset}/auctions/${HOUSE.id}`;
  const house = await client.get(base);
  const commodities = await client.get(`${base}/commodities`);
  const listings = unitListings(house, commodities);
  const list = buildPriceList(listings, HOUSE, new Date());
  checkPriceList(list);

  // Write then rename, so a crash never leaves a half-written file for the KV upload step.
  const tmpFile = `${OUTPUT_FILE}.tmp`;
  await writeFile(tmpFile, JSON.stringify(list));
  await rename(tmpFile, OUTPUT_FILE);
  console.log(`Priced ${Object.keys(list.prices).length} items from ${listings.length} listings in house ${HOUSE.id}`);
}

const runAsScript = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runAsScript) await main();

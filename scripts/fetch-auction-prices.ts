/**
 * Downloads one WoW Forever auction house from the Blizzard API, works out a market value per item,
 * estimates sales by comparing with the previous run's snapshot, and writes auction-prices.json and
 * auction-history.json. The GitHub workflow .github/workflows/auction-prices.yml runs it six times a day,
 * downloads the history from Cloudflare KV before it and stores both files in KV after it.
 *
 * Sales: a listing that vanishes (or a commodity stack that shrinks) before its time-left band could have
 * run out counts as sold. Cancels count too. Kept for 7 days.
 *
 * Run locally with `npm run fetch:auction-prices` (reads BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET
 * from .env), or `npm run auction:houses` to list the Alliance houses.
 *
 * Only type imports from src/ (erased when Node strips types), so Node runs this file directly. For the
 * same reason everything lives in this one file: Node can't resolve the @scripts/ alias.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuctionHouse, AuctionPriceList, ItemSales } from '@/prices/auctionPrices';

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

/** An API answer with the time Blizzard last changed its data (`Last-Modified`), null when missing or unreadable. */
export type BlizzardAnswer = {
  body: unknown;
  lastModified: Date | null;
};

export type BlizzardClient = {
  get(path: string): Promise<unknown>;
  getAnswer(path: string): Promise<BlizzardAnswer>;
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
const DAY_MS = 24 * HOUR_MS;
/** Sales older than this are forgotten. */
const SALES_WINDOW_DAYS = 7;
const SALES_WINDOW_MS = SALES_WINDOW_DAYS * DAY_MS;
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
/** The job's memory between runs; the workflow downloads and uploads it (KV key `auction-history`). */
const HISTORY_FILE = resolve('auction-history.json');

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
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

/** Units sold of one item and the copper they brought. */
export type SoldItem = [quantity: number, copper: number];

/** What one run found sold since the previous run. */
export type SalesEvent = {
  /** ISO time of the snapshot that found the sales. */
  at: string;
  /** Time since the previous snapshot; the covered time this event adds. */
  gapMs: number;
  sold: Record<string, SoldItem>;
};

/** What the job carries from one run to the next (`auction-history.json`, KV key `auction-history`). */
export type AuctionHistory = {
  /** ISO time of the snapshot. */
  at: string;
  listings: Listing[];
  events: SalesEvent[];
};

/** The sales part of the price list. */
export type SalesSummary = {
  sales: Record<string, ItemSales>;
  salesDays: number;
};

/** A listing as stored: [id, itemId, unitPrice in whole copper, quantity, index in BANDS]. About 5 MB for 146 000. */
type StoredListing = [id: number, itemId: number, unitPrice: number, quantity: number, band: number];

type StoredHistory = {
  at: string;
  listings: StoredListing[];
  events: SalesEvent[];
};

/**
 * Units sold per item id between two snapshots `gapMs` apart. A listing counts only when its band's
 * minimum exceeds the gap, so it can't have expired: then a vanished listing sold its whole quantity
 * and a shrunk commodity stack sold the difference, at its unit price. Cancels count too; the API
 * can't tell them apart. Snapshots not apart in time (`gapMs` ≤ 0) show no sales.
 */
export function detectSales(previous: Listing[], current: Listing[], gapMs: number): Record<string, SoldItem> {
  if (gapMs <= 0) return {};
  const currentById = new Map<number, Listing>();
  for (const listing of current) currentById.set(listing.id, listing);
  const totals = new Map<string, SoldItem>();
  for (const before of previous) {
    if (bandMinimumMs(before.band) <= gapMs) continue;
    const after = currentById.get(before.id);
    const left = after === undefined || after.itemId !== before.itemId ? 0 : after.quantity;
    const sold = before.quantity - left;
    if (sold <= 0) continue;
    const key = String(before.itemId);
    const [quantity, copper] = totals.get(key) ?? [0, 0];
    totals.set(key, [quantity + sold, copper + sold * before.unitPrice]);
  }
  const sales: Record<string, SoldItem> = {};
  for (const [itemId, [quantity, copper]] of totals) sales[itemId] = [quantity, Math.round(copper)];
  return sales;
}

/** Keeps the events whose whole covered span lies within the last 7 days. */
export function pruneEvents(events: SalesEvent[], now: Date): SalesEvent[] {
  const windowStart = now.getTime() - SALES_WINDOW_MS;
  return events.filter((entry) => Date.parse(entry.at) - entry.gapMs >= windowStart);
}

/**
 * The history after this run, whose snapshot was taken at `now`: its listings become the snapshot, and
 * the sales since the previous snapshot become an event. No event when the gap reaches the VERY_LONG
 * minimum: then no listing can count, and the gap would only dilute the sales per day. A snapshot that
 * is not newer (the same data again, or an older answer) keeps the previous one; only old events go.
 */
export function nextHistory(previous: AuctionHistory | null, current: Listing[], now: Date): AuctionHistory {
  const at = now.toISOString();
  if (previous === null) return { at, listings: current, events: [] };
  const gapMs = now.getTime() - Date.parse(previous.at);
  if (gapMs <= 0) return { ...previous, events: pruneEvents(previous.events, now) };
  const events = [...previous.events];
  if (gapMs < bandMinimumMs('VERY_LONG')) events.push({ at, gapMs, sold: detectSales(previous.listings, current, gapMs) });
  return { at, listings: current, events: pruneEvents(events, now) };
}

export function serializeHistory(history: AuctionHistory): string {
  const stored: StoredHistory = {
    at: history.at,
    listings: history.listings.map((entry): StoredListing => [
      entry.id,
      entry.itemId,
      Math.round(entry.unitPrice),
      entry.quantity,
      BANDS.indexOf(entry.band),
    ]),
    events: history.events,
  };
  return JSON.stringify(stored);
}

function parseStoredListing(raw: unknown): Listing | null {
  if (!Array.isArray(raw) || raw.length !== 5) return null;
  const [id, itemId, unitPrice, quantity, bandIndex]: unknown[] = raw;
  if (!isPositiveInteger(id) || !isPositiveInteger(itemId) || !isPositiveInteger(quantity)) return null;
  if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  const band: TimeLeftBand | undefined = typeof bandIndex === 'number' ? BANDS[bandIndex] : undefined;
  if (band === undefined) return null;
  return { id, itemId, unitPrice, quantity, band };
}

function parseEvent(raw: unknown): SalesEvent | null {
  if (!isRecord(raw) || !isValidTime(raw.at) || !isRecord(raw.sold)) return null;
  const { gapMs } = raw;
  if (typeof gapMs !== 'number' || !Number.isFinite(gapMs) || gapMs <= 0) return null;
  const sold: Record<string, SoldItem> = {};
  for (const [itemId, entry] of Object.entries(raw.sold)) {
    if (!/^\d+$/.test(itemId) || !Array.isArray(entry)) continue;
    const [quantity, copper]: unknown[] = entry;
    if (isPositiveInteger(quantity) && typeof copper === 'number' && Number.isFinite(copper) && copper >= 0) sold[itemId] = [quantity, copper];
  }
  return { at: raw.at, gapMs, sold };
}

/**
 * Reads auction-history.json. Anything unreadable (an empty file, "Value not found", broken JSON, a wrong
 * shape) gives null, and the job starts a new history rather than fail the price update. Bad entries are
 * dropped one by one.
 */
export function parseHistory(text: string): AuctionHistory | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || !isValidTime(value.at) || !Array.isArray(value.listings)) return null;
  const listings: Listing[] = [];
  for (const raw of value.listings) {
    const parsed = parseStoredListing(raw);
    if (parsed !== null) listings.push(parsed);
  }
  const events: SalesEvent[] = [];
  for (const raw of Array.isArray(value.events) ? value.events : []) {
    const parsed = parseEvent(raw);
    if (parsed !== null) events.push(parsed);
  }
  return { at: value.at, listings, events };
}

/**
 * Sales per item over the covered time: perDay = units ÷ days covered, price = copper ÷ units. Covered
 * time is the sum of the gaps, so a missed run is not a day without sales. Null before the first comparison.
 */
export function summarizeSales(events: SalesEvent[]): SalesSummary | null {
  if (events.length === 0) return null;
  const coveredMs = events.reduce((sum, entry) => sum + entry.gapMs, 0);
  const salesDays = Math.min(SALES_WINDOW_DAYS, coveredMs / DAY_MS);
  const totals = new Map<string, SoldItem>();
  for (const entry of events) {
    for (const [itemId, [quantity, copper]] of Object.entries(entry.sold)) {
      const [soFar, spent] = totals.get(itemId) ?? [0, 0];
      totals.set(itemId, [soFar + quantity, spent + copper]);
    }
  }
  const sales: Record<string, ItemSales> = {};
  for (const [itemId, [quantity, copper]] of totals) {
    sales[itemId] = {
      perDay: Math.round((quantity / salesDays) * 100) / 100,
      price: Math.min(GOLD_CAP_COPPER, Math.max(1, Math.round(copper / quantity))),
    };
  }
  return { sales, salesDays };
}

/**
 * When the snapshot was taken: the older of the answers' Last-Modified times, since the snapshot is only
 * as new as its oldest part. The run time when any answer lacks one.
 */
export function snapshotTime(lastModified: (Date | null)[], runTime: Date): Date {
  let oldest: Date | null = null;
  for (const time of lastModified) {
    if (time === null) return runTime;
    if (oldest === null || time.getTime() < oldest.getTime()) oldest = time;
  }
  return oldest ?? runTime;
}

function lastModifiedOf(response: Response): Date | null {
  const header = response.headers.get('Last-Modified');
  const time = header === null ? Number.NaN : Date.parse(header);
  return Number.isNaN(time) ? null : new Date(time);
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

  const getAnswer = async (path: string): Promise<BlizzardAnswer> => {
    token ??= requestToken();
    const response = await deps.fetch(`${API}${path}?${QUERY}`, {
      headers: { Authorization: `Bearer ${await token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${path} answered ${response.status}`);
    const body: unknown = await response.json();
    return { body, lastModified: lastModifiedOf(response) };
  };

  return {
    async get(path) {
      return (await getAnswer(path)).body;
    },
    getAnswer,
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

export function buildPriceList(listings: Listing[], house: AuctionHouse, now: Date, sales: SalesSummary | null): AuctionPriceList {
  const list: AuctionPriceList = { updatedAt: now.toISOString(), house, prices: marketValues(listings), quantities: totalQuantities(listings) };
  if (sales !== null) {
    list.sales = sales.sales;
    list.salesDays = sales.salesDays;
  }
  return list;
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

/** The previous run's history, or null on the first run or when the file is unreadable. */
async function readHistory(): Promise<AuctionHistory | null> {
  let text: string;
  try {
    text = await readFile(HISTORY_FILE, 'utf8');
  } catch {
    return null; // no file: the first run, or the workflow could not download it
  }
  const history = parseHistory(text);
  if (history === null) console.warn('auction-history.json is unreadable; starting a new sales history');
  return history;
}

/** Write then rename, so a crash never leaves a half-written file for the KV upload step. */
async function writeAtomically(file: string, content: string): Promise<void> {
  const tmpFile = `${file}.tmp`;
  await writeFile(tmpFile, content);
  await rename(tmpFile, file);
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
  const house = await client.getAnswer(base);
  const commodities = await client.getAnswer(`${base}/commodities`);
  const listings = unitListings(house.body, commodities.body);
  const now = new Date();
  // The snapshot is dated by Blizzard's data, not by this run: the answers can lag the run by an hour.
  const takenAt = snapshotTime([house.lastModified, commodities.lastModified], now);
  const history = nextHistory(await readHistory(), listings, takenAt);
  const list = buildPriceList(listings, HOUSE, now, summarizeSales(history.events));
  checkPriceList(list);

  // A broken answer stops above, so neither file replaces good data.
  await writeAtomically(HISTORY_FILE, serializeHistory(history));
  await writeAtomically(OUTPUT_FILE, JSON.stringify(list));
  const salesText = list.salesDays === undefined ? 'no sales yet' : `sales over ${list.salesDays.toFixed(2)} days`;
  console.log(
    `Priced ${Object.keys(list.prices).length} items from ${listings.length} listings in house ${HOUSE.id} (data of ${takenAt.toISOString()}); ${salesText}`,
  );
}

const runAsScript = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runAsScript) await main();

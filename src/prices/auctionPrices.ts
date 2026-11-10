import { fromCopper, GOLD_CAP_COPPER } from '@/money/money';
import { priceKey, type Entry, type Prices } from '@/sheet/sheet';

export type AuctionHouse = {
  ruleset: number;
  id: number;
  name: string;
};

/** What the update job stores in KV and the Worker serves at /api/auction-prices. */
export type AuctionPriceList = {
  /** ISO time of the download. */
  updatedAt: string;
  house: AuctionHouse;
  /** Market value in copper per Blizzard (= ForeverDB) item id. */
  prices: Record<string, number>;
};

/** Auction copper per price key (`name:<lower-case name>`), for the names on the page that are linked to an item. */
export type AuctionPricesByKey = Record<string, number>;

export type AuctionHint = { kind: 'none' } | { kind: 'notListed' } | { kind: 'restore'; copper: number };

export type AuctionPricesState = {
  /** null while loading, and after a failed load. */
  list: AuctionPriceList | null;
  failed: boolean;
};

export type AuctionStatus = {
  text: string;
  /** Shown in the warning style. */
  stale: boolean;
};

type UnknownRecord = Record<string, unknown>;

type LinkedPriceKey = {
  key: string;
  itemId: number;
};

const MARKET_LABEL = 'US Alliance';
const STALE_AFTER_HOURS = 48;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function parseAuctionPriceList(value: unknown): AuctionPriceList | null {
  if (!isRecord(value) || typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) return null;
  if (!isRecord(value.house) || !isRecord(value.prices)) return null;
  const { ruleset, id, name } = value.house;
  if (!isWholeNumber(ruleset) || !isWholeNumber(id) || typeof name !== 'string') return null;
  const prices: Record<string, number> = {};
  for (const [itemId, copper] of Object.entries(value.prices)) {
    if (/^\d+$/.test(itemId) && isWholeNumber(copper) && copper > 0 && copper <= GOLD_CAP_COPPER) prices[itemId] = copper;
  }
  return { updatedAt: value.updatedAt, house: { ruleset, id, name }, prices };
}

function linkedItems(entries: Entry[]): LinkedPriceKey[] {
  return entries.flatMap((entry): LinkedPriceKey[] => {
    if (entry.kind === 'item') {
      return entry.itemId === null || entry.name.trim() === '' ? [] : [{ key: priceKey(entry.name), itemId: entry.itemId }];
    }
    return (entry.recipe?.reagents ?? []).map((reagent) => ({ key: priceKey(reagent.name), itemId: reagent.itemId }));
  });
}

/** The first linked item of a name sets its price; typed-only rows of the same name share it through the key. */
export function auctionPricesByKey(entries: Entry[], prices: Record<string, number>): AuctionPricesByKey {
  const byKey: AuctionPricesByKey = {};
  for (const { key, itemId } of linkedItems(entries)) {
    const copper: number | undefined = prices[String(itemId)];
    if (!(key in byKey) && copper !== undefined) byKey[key] = copper;
  }
  return byKey;
}

/** Typed prices win; every other priced key comes from the auction. */
export function withAuctionPrices(typed: Prices, byKey: AuctionPricesByKey): Prices {
  const added = Object.entries(byKey).filter(([key]) => !(key in typed));
  if (added.length === 0) return typed;
  const merged: Prices = { ...typed };
  for (const [key, copper] of added) merged[key] = fromCopper(copper);
  return merged;
}

export function auctionHintOf(key: string, linked: boolean, typed: Prices, byKey: AuctionPricesByKey, loaded: boolean): AuctionHint {
  if (!loaded) return { kind: 'none' };
  const copper: number | undefined = byKey[key];
  if (key in typed) return copper === undefined ? { kind: 'none' } : { kind: 'restore', copper };
  return linked && copper === undefined ? { kind: 'notListed' } : { kind: 'none' };
}

function ageText(ageMs: number): string {
  if (ageMs < HOUR_MS) return `updated ${Math.max(1, Math.floor(ageMs / MINUTE_MS))} min ago`;
  if (ageMs < STALE_AFTER_HOURS * HOUR_MS) return `updated ${Math.floor(ageMs / HOUR_MS)} h ago`;
  return `are ${Math.floor(ageMs / DAY_MS)} days old`;
}

export function auctionStatusOf(state: AuctionPricesState, now: number): AuctionStatus | null {
  if (state.list === null) return state.failed ? { text: 'Auction prices unavailable', stale: true } : null;
  const ageMs = Math.max(0, now - Date.parse(state.list.updatedAt));
  return { text: `Auction prices ${ageText(ageMs)} · ${MARKET_LABEL}`, stale: ageMs >= STALE_AFTER_HOURS * HOUR_MS };
}

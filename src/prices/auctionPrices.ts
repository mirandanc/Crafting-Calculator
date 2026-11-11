import { GOLD_CAP_COPPER } from '@/money/money';

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
  /** Total quantity for sale per item id; missing from lists saved before it existed. */
  quantities?: Record<string, number>;
};

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

function parseQuantities(value: UnknownRecord): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const [itemId, quantity] of Object.entries(value)) {
    if (/^\d+$/.test(itemId) && isWholeNumber(quantity) && quantity > 0) quantities[itemId] = quantity;
  }
  return quantities;
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
  const list: AuctionPriceList = { updatedAt: value.updatedAt, house: { ruleset, id, name }, prices };
  if (isRecord(value.quantities)) list.quantities = parseQuantities(value.quantities);
  return list;
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

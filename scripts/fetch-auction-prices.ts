/**
 * Downloads one WoW Forever auction house from the Blizzard API, works out a market value per item,
 * and writes auction-prices.json. The GitHub workflow .github/workflows/auction-prices.yml runs it three
 * times a day and stores the file in Cloudflare KV.
 *
 * Run locally with `npm run fetch:auction-prices` (reads BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET
 * from .env), or `npm run auction:houses` to list the Alliance houses.
 *
 * Only type imports from src/ (erased when Node strips types), so Node runs this file directly.
 */

export type Listing = {
  itemId: number;
  /** Copper per unit. */
  unitPrice: number;
  quantity: number;
};

type UnknownRecord = Record<string, unknown>;

/** Share of an item's quantity for sale that its price is averaged over, cheapest listings first. */
const MARKET_SHARE = 0.15;

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

function itemIdOf(raw: UnknownRecord): number {
  const item = raw.item;
  if (!isRecord(item) || !isPositiveInteger(item.id) || !isPositiveInteger(raw.quantity)) {
    throw new Error(`Unexpected listing: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  return item.id;
}

/**
 * Flattens a house answer (regular auctions, `buyout` per auction) and its commodities answer
 * (`unit_price` per unit; the list is also named `auctions`) into per-unit listings. Bid-only
 * auctions are skipped. An empty house has no `auctions` field at all; an empty commodities answer
 * is not allowed to miss it.
 */
export function unitListings(house: unknown, commodities: unknown): Listing[] {
  const listings: Listing[] = [];
  for (const raw of listingsOf(house, 'auctions', false)) {
    if (!isRecord(raw)) throw new Error('Unexpected listing in auctions');
    const itemId = itemIdOf(raw);
    if (raw.buyout === undefined) continue;
    if (!isPositiveInteger(raw.buyout)) throw new Error(`Unexpected listing buyout for item ${itemId}`);
    const quantity = raw.quantity as number;
    listings.push({ itemId, unitPrice: raw.buyout / quantity, quantity });
  }
  for (const raw of listingsOf(commodities, 'commodities', true)) {
    if (!isRecord(raw)) throw new Error('Unexpected listing in commodities');
    const itemId = itemIdOf(raw);
    if (!isPositiveInteger(raw.unit_price)) throw new Error(`Unexpected listing unit_price for item ${itemId}`);
    listings.push({ itemId, unitPrice: raw.unit_price, quantity: raw.quantity as number });
  }
  return listings;
}

/** Quantity-weighted average of the cheapest listings that reach MARKET_SHARE of the quantity for sale. */
export function marketValue(listings: Listing[]): number {
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
  return Math.round(spent / taken);
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

import { fromCopper } from '@/money/money';
import { priceKey, type Entry, type Prices } from '@/sheet/sheet';

/** Copper per item id. */
export type ItemPrices = Record<string, number>;

export type PriceSource = 'auction' | 'vendor';

export type MarketPrice = {
  copper: number;
  source: PriceSource;
};

/** Market price per price key (`name:<lower-case name>`), for the names on the page that are linked to an item. */
export type MarketPricesByKey = Record<string, MarketPrice>;

export type PriceHint =
  | { kind: 'none' }
  | { kind: 'notListed' }
  | { kind: 'vendor' }
  | { kind: 'restore'; copper: number; source: PriceSource };

type LinkedPriceKey = {
  key: string;
  itemId: number;
};

/** The cheaper of the auction and vendor prices; the auction wins a tie. */
export function marketPriceOf(itemId: number, auction: ItemPrices, vendor: ItemPrices): MarketPrice | null {
  const fromAuction: number | undefined = auction[String(itemId)];
  const fromVendor: number | undefined = vendor[String(itemId)];
  if (fromVendor !== undefined && (fromAuction === undefined || fromVendor < fromAuction)) {
    return { copper: fromVendor, source: 'vendor' };
  }
  return fromAuction === undefined ? null : { copper: fromAuction, source: 'auction' };
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
export function marketPricesByKey(entries: Entry[], auction: ItemPrices, vendor: ItemPrices): MarketPricesByKey {
  const byKey: MarketPricesByKey = {};
  for (const { key, itemId } of linkedItems(entries)) {
    if (key in byKey) continue;
    const price = marketPriceOf(itemId, auction, vendor);
    if (price !== null) byKey[key] = price;
  }
  return byKey;
}

/** Typed prices win; every other priced key comes from the market. */
export function withMarketPrices(typed: Prices, byKey: MarketPricesByKey): Prices {
  const added = Object.entries(byKey).filter(([key]) => !(key in typed));
  if (added.length === 0) return typed;
  const merged: Prices = { ...typed };
  for (const [key, price] of added) merged[key] = fromCopper(price.copper);
  return merged;
}

/** `auctionLoaded` only gates "Not on AH": before the auction answers, a missing price proves nothing. */
export function priceHintOf(key: string, linked: boolean, typed: Prices, byKey: MarketPricesByKey, auctionLoaded: boolean): PriceHint {
  const price: MarketPrice | undefined = byKey[key];
  if (key in typed) return price === undefined ? { kind: 'none' } : { kind: 'restore', copper: price.copper, source: price.source };
  if (price !== undefined) return price.source === 'vendor' ? { kind: 'vendor' } : { kind: 'none' };
  return linked && auctionLoaded ? { kind: 'notListed' } : { kind: 'none' };
}

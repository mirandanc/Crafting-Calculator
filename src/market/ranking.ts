import type { ItemSales } from '@/prices/auctionPrices';
import { marketPriceOf, type ItemPrices, type PriceSource } from '@/prices/marketPrices';
import type { CatalogItem, CatalogRecipe, RecipeCatalog } from '@/recipes/catalog';

/** Profit per day (profit per craft × estimated sales a day), or margin. */
export type RankingSort = 'profitPerDay' | 'margin';

export type RankingMarket = {
  auction: ItemPrices;
  /** Quantity for sale per item id; null for an auction list saved before quantities existed. */
  quantities: Record<string, number> | null;
  /** Estimated sales per item id; null until the auction job has compared two snapshots. */
  sales: Record<string, ItemSales> | null;
  /** Days of snapshots the sales cover; null while sales are unknown. */
  salesDays: number | null;
  vendor: ItemPrices;
};

export type RankingFilter = {
  /** None selected means every profession. */
  professions: string[];
  /** Minimum profit per craft, in copper. */
  minProfit: number;
};

export type RankedReagent = {
  itemId: number;
  name: string;
  icon: string | null;
  count: number;
  /** Copper per item, from the cheaper of auction and vendor. */
  unitPrice: number;
  source: PriceSource;
};

export type RankedRecipe = {
  recipe: CatalogRecipe;
  reagents: RankedReagent[];
  /** What one craft sells for on the auction house, after its cut. */
  revenue: number;
  /** What one craft's reagents cost. */
  cost: number;
  profit: number;
  /** profit ÷ cost: 0.5 means 50%. */
  margin: number;
  /** Estimated sales of the result per day; null while sales are unknown. */
  salesPerDay: number | null;
  /** profit × salesPerDay, in whole copper; null while sales are unknown. */
  profitPerDay: number | null;
};

/** The auction house keeps 5% of every sale. */
const AH_CUT = 0.05;
/** Fewer for sale than this and the price is one seller's guess, not a market. */
const MIN_LISTED = 5;
/** Sells fewer a day than this and the listing price is a hope, not a market. */
const MIN_SALES_PER_DAY = 5;
/** Above 1500% the "price" is a listing far above the item's worth that nobody buys. */
const MAX_MARGIN = 15;

type CompareRanked = (a: RankedRecipe, b: RankedRecipe) => number;

const byName: CompareRanked = (a, b) => a.recipe.name.localeCompare(b.recipe.name, 'en');
const byMargin: CompareRanked = (a, b) => b.margin - a.margin || b.profit - a.profit || byName(a, b);
const byProfitPerDay: CompareRanked = (a, b) => (b.profitPerDay ?? 0) - (a.profitPerDay ?? 0) || b.margin - a.margin || byName(a, b);

function rankedReagents(recipe: CatalogRecipe, items: Record<string, CatalogItem>, market: RankingMarket): RankedReagent[] | null {
  const reagents: RankedReagent[] = [];
  for (const reagent of recipe.reagents) {
    const price = marketPriceOf(reagent.itemId, market.auction, market.vendor);
    if (price === null) return null;
    const item: CatalogItem | undefined = items[String(reagent.itemId)];
    reagents.push({
      itemId: reagent.itemId,
      name: item?.name ?? `Item ${reagent.itemId}`,
      icon: item?.icon ?? null,
      count: reagent.count,
      unitPrice: price.copper,
      source: price.source,
    });
  }
  return reagents;
}

/**
 * At least MIN_SALES_PER_DAY a day, from at least MIN_SALES_PER_DAY counted sales: early on, one sale in an hour
 * reads as 24 a day. Without the covered days the rate can't be trusted.
 */
function trustedRate(perDay: number, salesDays: number | null): boolean {
  if (salesDays === null || perDay < MIN_SALES_PER_DAY) return false;
  // perDay × salesDays gives back the counted sales, give or take float rounding.
  return perDay * salesDays >= MIN_SALES_PER_DAY - 1e-9;
}

function rankOne(recipe: CatalogRecipe, catalog: RecipeCatalog, market: RankingMarket): RankedRecipe | null {
  if (recipe.makes === null || recipe.cooldown === true || recipe.reagents.length === 0) return null;
  const key = String(recipe.makes.itemId);
  const auctionUnit: number | undefined = market.auction[key];
  if (auctionUnit === undefined) return null;
  if (market.quantities !== null && (market.quantities[key] ?? 0) < MIN_LISTED) return null;
  let sellUnit = auctionUnit;
  let salesPerDay: number | null = null;
  if (market.sales !== null) {
    const sales: ItemSales | undefined = market.sales[key];
    if (sales === undefined || !trustedRate(sales.perDay, market.salesDays)) return null;
    // Today's listings may sit above what buyers actually paid.
    sellUnit = Math.min(auctionUnit, sales.price);
    salesPerDay = sales.perDay;
  }
  const reagents = rankedReagents(recipe, catalog.items, market);
  if (reagents === null) return null;
  const cost = reagents.reduce((sum, reagent) => sum + reagent.unitPrice * reagent.count, 0);
  if (cost <= 0) return null;
  const revenue = Math.floor(sellUnit * recipe.makes.count * (1 - AH_CUT));
  const profit = revenue - cost;
  const margin = profit / cost;
  if (margin > MAX_MARGIN) return null;
  const profitPerDay = salesPerDay === null ? null : Math.floor(profit * salesPerDay);
  return { recipe, reagents, revenue, cost, profit, margin, salesPerDay, profitPerDay };
}

/**
 * Every recipe worth listing. By profit per day (then margin, then name) once sales are known; by margin
 * (then profit, then name) when asked, or while sales are still unknown.
 */
export function rankRecipes(catalog: RecipeCatalog, market: RankingMarket, filter: RankingFilter, sort: RankingSort): RankedRecipe[] {
  const ranked: RankedRecipe[] = [];
  for (const recipe of catalog.recipes) {
    if (filter.professions.length > 0 && !filter.professions.includes(recipe.profession)) continue;
    const entry = rankOne(recipe, catalog, market);
    if (entry !== null && entry.profit >= filter.minProfit) ranked.push(entry);
  }
  return ranked.sort(sort === 'margin' || market.sales === null ? byMargin : byProfitPerDay);
}

export function formatMargin(margin: number): string {
  return `${Math.round(margin * 100).toLocaleString('en-US')}%`;
}

/** "14 sold in a day": always a whole number, rounded down. */
export function formatSoldPerDay(perDay: number): string {
  return `${Math.floor(perDay).toLocaleString('en-US')} sold in a day`;
}

/** How much auction history the sales come from, in whole days rounded down; "< 1 day" before the first full day. */
export function formatSalesCoverage(salesDays: number): string {
  const days = Math.floor(salesDays);
  if (days < 1) return 'Sales from the last < 1 day';
  return `Sales from the last ${days} ${days === 1 ? 'day' : 'days'}`;
}

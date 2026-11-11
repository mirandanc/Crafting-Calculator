import { marketPriceOf, type ItemPrices, type PriceSource } from '@/prices/marketPrices';
import type { CatalogItem, CatalogRecipe, RecipeCatalog } from '@/recipes/catalog';

export type RankingMarket = {
  auction: ItemPrices;
  /** Quantity for sale per item id; null for an auction list saved before quantities existed. */
  quantities: Record<string, number> | null;
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
};

/** The auction house keeps 5% of every sale. */
const AH_CUT = 0.05;
/** Fewer for sale than this and the price is one seller's guess, not a market. */
const MIN_LISTED = 5;

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

function rankOne(recipe: CatalogRecipe, catalog: RecipeCatalog, market: RankingMarket): RankedRecipe | null {
  if (recipe.makes === null || recipe.cooldown === true || recipe.reagents.length === 0) return null;
  const key = String(recipe.makes.itemId);
  const sellUnit: number | undefined = market.auction[key];
  if (sellUnit === undefined) return null;
  if (market.quantities !== null && (market.quantities[key] ?? 0) < MIN_LISTED) return null;
  const reagents = rankedReagents(recipe, catalog.items, market);
  if (reagents === null) return null;
  const cost = reagents.reduce((sum, reagent) => sum + reagent.unitPrice * reagent.count, 0);
  if (cost <= 0) return null;
  const revenue = Math.floor(sellUnit * recipe.makes.count * (1 - AH_CUT));
  const profit = revenue - cost;
  return { recipe, reagents, revenue, cost, profit, margin: profit / cost };
}

/** Every recipe worth listing, best margin first (then profit, then name). */
export function rankRecipes(catalog: RecipeCatalog, market: RankingMarket, filter: RankingFilter): RankedRecipe[] {
  const ranked: RankedRecipe[] = [];
  for (const recipe of catalog.recipes) {
    if (filter.professions.length > 0 && !filter.professions.includes(recipe.profession)) continue;
    const entry = rankOne(recipe, catalog, market);
    if (entry !== null && entry.profit >= filter.minProfit) ranked.push(entry);
  }
  return ranked.sort((a, b) => b.margin - a.margin || b.profit - a.profit || a.recipe.name.localeCompare(b.recipe.name, 'en'));
}

export function formatMargin(margin: number): string {
  return `${Math.round(margin * 100).toLocaleString('en-US')}%`;
}

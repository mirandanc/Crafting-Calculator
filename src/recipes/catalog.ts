import { MAX_RESULTS, rankByName } from '@/search/rank';

export type CatalogItem = {
  name: string;
  /** Full ForeverDB icon URL; null when the item lookup failed while fetching. */
  icon: string | null;
};

export type CatalogProduct = {
  itemId: number;
  name: string;
  /** Items made per craft (ForeverDB's expected count for random yields). */
  count: number;
};

export type CatalogReagent = {
  itemId: number;
  count: number;
};

export type CatalogRecipe = {
  /** ForeverDB spell id. */
  id: number;
  name: string;
  profession: string;
  icon: string;
  /** null for recipes that make no item (enchants, tinkers): ×N then counts casts. */
  makes: CatalogProduct | null;
  reagents: CatalogReagent[];
  /** True when the recipe has a cooldown (Mooncloth, transmutes): the market analysis leaves it out. */
  cooldown?: boolean;
};

export type RecipeCatalog = {
  build: string;
  /** Reagent items keyed by item id. */
  items: Record<string, CatalogItem>;
  /** Cheapest gold-only, unlimited Alliance (or neutral) vendor price in copper, per reagent item id. */
  vendorPrices: Record<string, number>;
  recipes: CatalogRecipe[];
};

/** Searches the selected professions only; none selected means all. */
export function searchRecipes(catalog: RecipeCatalog, query: string, professions: string[]): CatalogRecipe[] {
  const recipes =
    professions.length === 0 ? catalog.recipes : catalog.recipes.filter((recipe) => professions.includes(recipe.profession));
  return rankByName(recipes, query, MAX_RESULTS);
}

export function professionsOf(catalog: RecipeCatalog): string[] {
  return [...new Set(catalog.recipes.map((recipe) => recipe.profession))].sort((a, b) => a.localeCompare(b, 'en'));
}

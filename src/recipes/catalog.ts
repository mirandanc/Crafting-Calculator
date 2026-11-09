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
};

export type RecipeCatalog = {
  build: string;
  /** Reagent items keyed by item id. */
  items: Record<string, CatalogItem>;
  recipes: CatalogRecipe[];
};

export function searchRecipes(catalog: RecipeCatalog, query: string): CatalogRecipe[] {
  return rankByName(catalog.recipes, query, MAX_RESULTS);
}

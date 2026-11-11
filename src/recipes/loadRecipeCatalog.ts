import recipesUrl from '@/data/recipes.json?url';
import type { RecipeCatalog } from '@/recipes/catalog';

let pending: Promise<RecipeCatalog> | null = null;

async function fetchCatalog(): Promise<RecipeCatalog> {
  const response = await fetch(recipesUrl);
  if (!response.ok) throw new Error(`Recipe catalog request failed: ${response.status}`);
  const catalog = (await response.json()) as RecipeCatalog;
  // Files written before vendor prices existed have none.
  return { ...catalog, vendorPrices: catalog.vendorPrices ?? {} };
}

/** Loads src/data/recipes.json once per page; a failed load is retried on the next call. */
export function loadRecipeCatalog(): Promise<RecipeCatalog> {
  pending ??= fetchCatalog().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

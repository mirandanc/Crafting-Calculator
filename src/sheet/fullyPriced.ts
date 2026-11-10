import { priceKey, unitPriceOf, type Entry, type Prices } from '@/sheet/sheet';

export function isEntryFullyPriced(entry: Entry, prices: Prices): boolean {
  if (entry.kind === 'item') {
    return (
      entry.name.trim() !== '' &&
      entry.quantity !== null &&
      entry.quantity >= 1 &&
      unitPriceOf(prices, priceKey(entry.name)) > 0
    );
  }
  const { recipe, wanted } = entry;
  if (recipe === null || wanted === null || wanted < 1 || recipe.reagents.length === 0) return false;
  return recipe.reagents.every((reagent) => unitPriceOf(prices, priceKey(reagent.name)) > 0);
}

export function fullyPricedEntryIds(entries: Entry[], prices: Prices): string[] {
  return entries.filter((entry) => isEntryFullyPriced(entry, prices)).map((entry) => entry.id);
}

/** True when at least one of the entry's prices was typed by the player (not filled from the auction). */
export function usesTypedPrice(entry: Entry, typed: Prices): boolean {
  if (entry.kind === 'item') return entry.name.trim() !== '' && priceKey(entry.name) in typed;
  return (entry.recipe?.reagents ?? []).some((reagent) => priceKey(reagent.name) in typed);
}

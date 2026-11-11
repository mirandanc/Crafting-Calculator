import { useEffect, useMemo, useState } from 'react';
import { coinsEqual, normalizeCoins, toCopper, type Coins } from '@/money/money';
import type { CatalogItem, CatalogRecipe } from '@/recipes/catalog';
import {
  createDefaultSheet,
  createItemRow,
  createRecipeBlock,
  withCraftedRecipe,
  withItemName,
  withLinkedItem,
  withoutEntry,
  withoutReagent,
  withRecipe,
  type Entry,
  type ItemRow,
  type LinkedItem,
  type Prices,
  type RecipeBlock,
  type Sheet,
} from '@/sheet/sheet';
import { loadSheet, saveSheet } from '@/sheet/storage';

export type SheetActions = {
  addRecipe: () => void;
  addItem: () => void;
  removeEntry: (id: string) => void;
  eraseAll: () => void;
  chooseRecipe: (id: string, recipe: CatalogRecipe, items: Record<string, CatalogItem>) => void;
  /** Adds one craft of a recipe from the market analysis. */
  addCraftedRecipe: (recipe: CatalogRecipe, items: Record<string, CatalogItem>) => void;
  setWanted: (id: string, wanted: number | null) => void;
  removeReagent: (id: string, itemId: number) => void;
  renameItem: (id: string, name: string) => void;
  linkItem: (id: string, item: LinkedItem) => void;
  setItemQuantity: (id: string, quantity: number | null) => void;
  setPrice: (key: string, price: Coins) => void;
  normalizePrice: (key: string) => void;
  /** Drops the typed price, so the item falls back to its auction price (if any). */
  clearPrice: (key: string) => void;
  setMuted: (muted: boolean) => void;
};

export type SheetState = {
  sheet: Sheet;
  actions: SheetActions;
};

function withoutPrice(prices: Prices, key: string): Prices {
  return Object.fromEntries(Object.entries(prices).filter(([candidate]) => candidate !== key));
}

export function useSheet(): SheetState {
  const [sheet, setSheet] = useState<Sheet>(() => loadSheet() ?? createDefaultSheet());

  useEffect(() => {
    saveSheet(sheet);
  }, [sheet]);

  // setSheet's identity never changes, so every action below can be built once and reused for the
  // lifetime of the component; consumers (e.g. memoized children) can rely on stable identities.
  const actions = useMemo<SheetActions>(() => {
    const mapEntry = (id: string, change: (entry: Entry) => Entry) =>
      setSheet((current) => {
        let changed = false;
        const entries = current.entries.map((entry) => {
          if (entry.id !== id) return entry;
          const next = change(entry);
          if (next !== entry) changed = true;
          return next;
        });
        return changed ? { ...current, entries } : current;
      });

    const mapRecipe = (id: string, change: (block: RecipeBlock) => RecipeBlock) =>
      mapEntry(id, (entry) => (entry.kind === 'recipe' ? change(entry) : entry));

    const mapItem = (id: string, change: (row: ItemRow) => ItemRow) =>
      mapEntry(id, (entry) => (entry.kind === 'item' ? change(entry) : entry));

    return {
      addRecipe: () => setSheet((current) => ({ ...current, entries: [...current.entries, createRecipeBlock()] })),
      addItem: () => setSheet((current) => ({ ...current, entries: [...current.entries, createItemRow()] })),
      removeEntry: (id) => setSheet((current) => ({ ...current, entries: withoutEntry(current.entries, id) })),
      eraseAll: () => setSheet((current) => ({ ...createDefaultSheet(), muted: current.muted })),
      chooseRecipe: (id, recipe, items) => mapRecipe(id, (block) => withRecipe(block, recipe, items)),
      addCraftedRecipe: (recipe, items) =>
        setSheet((current) => ({ ...current, entries: withCraftedRecipe(current.entries, recipe, items) })),
      setWanted: (id, wanted) => mapRecipe(id, (block) => ({ ...block, wanted })),
      removeReagent: (id, itemId) => mapRecipe(id, (block) => withoutReagent(block, itemId)),
      renameItem: (id, name) => mapItem(id, (row) => withItemName(row, name)),
      linkItem: (id, item) => mapItem(id, (row) => withLinkedItem(row, item)),
      setItemQuantity: (id, quantity) => mapItem(id, (row) => ({ ...row, quantity })),
      setPrice: (key, price) => setSheet((current) => ({ ...current, prices: { ...current.prices, [key]: price } })),
      normalizePrice: (key) =>
        setSheet((current) => {
          const price: Coins | undefined = current.prices[key];
          if (price === undefined) return current;
          // Left empty: the typed price goes away (an auction price, if any, shows again).
          if (toCopper(price) === 0) return { ...current, prices: withoutPrice(current.prices, key) };
          const normalized = normalizeCoins(price);
          return coinsEqual(normalized, price) ? current : { ...current, prices: { ...current.prices, [key]: normalized } };
        }),
      clearPrice: (key) =>
        setSheet((current) => (Object.hasOwn(current.prices, key) ? { ...current, prices: withoutPrice(current.prices, key) } : current)),
      setMuted: (muted) => setSheet((current) => ({ ...current, muted })),
    };
  }, []);

  return { sheet, actions };
}

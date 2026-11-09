import { toCopper, type Coins } from '@/money/money';
import type { CatalogItem, CatalogProduct, CatalogRecipe } from '@/recipes/catalog';

export type ReagentLine = {
  itemId: number;
  name: string;
  icon: string | null;
  /** Locked quantity per craft (or per cast). */
  perCraft: number;
};

export type PickedRecipe = {
  spellId: number;
  name: string;
  profession: string;
  icon: string;
  makes: CatalogProduct | null;
  reagents: ReagentLine[];
};

export type RecipeBlock = {
  kind: 'recipe';
  id: string;
  recipe: PickedRecipe | null;
  /** ×N: items wanted, or casts when the recipe makes no item. null while the field is empty. */
  wanted: number | null;
};

export type ItemRow = {
  kind: 'item';
  id: string;
  name: string;
  /** ForeverDB item id when picked from the search; null for free text. */
  itemId: number | null;
  icon: string | null;
  quantity: number | null;
};

export type Entry = RecipeBlock | ItemRow;

/** Unit prices shared per item, keyed by `name:<trimmed lower-case name>` so typed and linked rows of the same item share one price. */
export type Prices = Record<string, Coins>;

export type Sheet = {
  entries: Entry[];
  prices: Prices;
  muted: boolean;
};

export type LinkedItem = {
  itemId: number;
  name: string;
  icon: string;
};

export const MAX_QUANTITY = 9_999;
export const MAX_WANTED = 999;

const NO_PRICE: Coins = { gold: 0, silver: 0, copper: 0 };

export function createRecipeBlock(): RecipeBlock {
  return { kind: 'recipe', id: crypto.randomUUID(), recipe: null, wanted: null };
}

export function createItemRow(): ItemRow {
  return { kind: 'item', id: crypto.randomUUID(), name: '', itemId: null, icon: null, quantity: null };
}

export function createDefaultSheet(): Sheet {
  return { entries: [createRecipeBlock()], prices: {}, muted: false };
}

function parseWhole(raw: string, min: number, max: number): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function parseQuantity(raw: string): number | null {
  return parseWhole(raw, 0, MAX_QUANTITY);
}

/** ×N is at least 1 once entered: an empty field stays null, but '0' (or any lower value) clamps up to 1. */
export function parseWanted(raw: string): number | null {
  return parseWhole(raw, 1, MAX_WANTED);
}

export function priceKey(name: string): string {
  return `name:${name.trim().toLowerCase()}`;
}

export function priceOf(prices: Prices, key: string): Coins {
  const price: Coins | undefined = prices[key];
  return price ?? { ...NO_PRICE };
}

export function unitPriceOf(prices: Prices, key: string): number {
  return toCopper(priceOf(prices, key));
}

export function withoutEntry(entries: Entry[], id: string): Entry[] {
  const remaining = entries.filter((entry) => entry.id !== id);
  return remaining.length === 0 ? [createRecipeBlock()] : remaining;
}

/** Picks a recipe: copies its reagents fresh, so picking the same recipe again restores removed ones. */
export function withRecipe(block: RecipeBlock, recipe: CatalogRecipe, items: Record<string, CatalogItem>): RecipeBlock {
  const reagents = recipe.reagents.map((reagent): ReagentLine => {
    const item: CatalogItem | undefined = items[String(reagent.itemId)];
    return {
      itemId: reagent.itemId,
      name: item?.name ?? `Item ${reagent.itemId}`,
      icon: item?.icon ?? null,
      perCraft: reagent.count,
    };
  });
  return {
    ...block,
    recipe: {
      spellId: recipe.id,
      name: recipe.name,
      profession: recipe.profession,
      icon: recipe.icon,
      makes: recipe.makes,
      reagents,
    },
    wanted: block.wanted !== null && block.wanted >= 1 ? block.wanted : 1,
  };
}

export function withoutReagent(block: RecipeBlock, itemId: number): RecipeBlock {
  if (block.recipe === null) return block;
  return {
    ...block,
    recipe: { ...block.recipe, reagents: block.recipe.reagents.filter((reagent) => reagent.itemId !== itemId) },
  };
}

/** Typing a name always turns the row back into free text. */
export function withItemName(row: ItemRow, name: string): ItemRow {
  return { ...row, name, itemId: null, icon: null };
}

export function withLinkedItem(row: ItemRow, item: LinkedItem): ItemRow {
  return { ...row, name: item.name, itemId: item.itemId, icon: item.icon };
}

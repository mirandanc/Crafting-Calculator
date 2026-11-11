import { describe, expect, it } from 'vitest';
import {
  createDefaultSheet,
  createItemRow,
  createRecipeBlock,
  MAX_QUANTITY,
  MAX_WANTED,
  parseQuantity,
  parseWanted,
  priceKey,
  priceOf,
  unitPriceOf,
  withCraftedRecipe,
  withItemName,
  withLinkedItem,
  withoutEntry,
  withoutReagent,
  withRecipe,
  type Prices,
  type RecipeBlock,
} from '@/sheet/sheet';
import { summarizeShopping } from '@/sheet/shopping';
import { TEST_CATALOG, testRecipe } from '@/test/catalogFixture';
import { recipeBlock } from '@/test/sheetFixtures';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const prop of Object.getOwnPropertyNames(value)) deepFreeze((value as Record<string, unknown>)[prop]);
    Object.freeze(value);
  }
  return value;
}

const emptyBlock = (wanted: number | null = null): RecipeBlock => ({ kind: 'recipe', id: 'r', recipe: null, wanted });

describe('factories', () => {
  it('starts a sheet with one empty recipe block, no prices, sound on', () => {
    const sheet = createDefaultSheet();
    expect(sheet.entries).toHaveLength(1);
    expect(sheet.entries[0]).toMatchObject({ kind: 'recipe', recipe: null, wanted: null });
    expect(sheet.prices).toEqual({});
    expect(sheet.muted).toBe(false);
  });

  it('creates entries with unique ids', () => {
    expect(createRecipeBlock().id).not.toBe(createRecipeBlock().id);
    expect(createItemRow()).toMatchObject({ kind: 'item', name: '', itemId: null, icon: null, quantity: null });
  });
});

describe('parseQuantity and parseWanted', () => {
  it('return null for empty or non-numeric input', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
    expect(parseWanted('  ')).toBeNull();
  });

  it('truncate and clamp to their maximum', () => {
    expect(parseQuantity('3.7')).toBe(3);
    expect(parseQuantity('-2')).toBe(0);
    expect(parseQuantity('20000')).toBe(MAX_QUANTITY);
    expect(parseWanted('1500')).toBe(MAX_WANTED);
    expect(MAX_WANTED).toBe(999);
  });

  it('clamps parseWanted up to 1: ×N is never zero once entered', () => {
    expect(parseWanted('0')).toBe(1);
    expect(parseWanted('-5')).toBe(1);
  });
});

describe('prices', () => {
  const prices: Prices = { 'name:copper bar': { gold: 0, silver: 1, copper: 5 } };

  it('keys every item by its trimmed, lower-cased name, linked or not', () => {
    expect(priceKey('Copper Bar')).toBe('name:copper bar');
    expect(priceKey('  Linen CLOTH ')).toBe('name:linen cloth');
  });

  it('reads a price, defaulting to zero', () => {
    expect(priceOf(prices, 'name:copper bar')).toEqual({ gold: 0, silver: 1, copper: 5 });
    expect(priceOf(prices, 'name:nothing')).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(unitPriceOf(prices, 'name:copper bar')).toBe(105);
    expect(unitPriceOf(prices, 'name:x')).toBe(0);
  });

  it('returns a fresh object for a missing price, never the shared default', () => {
    const first = priceOf(prices, 'name:nothing');
    first.gold = 999;
    expect(priceOf(prices, 'name:also-nothing')).toEqual({ gold: 0, silver: 0, copper: 0 });
  });
});

describe('withoutEntry', () => {
  it('removes the entry', () => {
    const keep = createItemRow();
    expect(withoutEntry([emptyBlock(), keep], 'r')).toEqual([keep]);
  });

  it('leaves one fresh empty recipe block when the last entry goes', () => {
    const [remaining] = withoutEntry([emptyBlock()], 'r');
    expect(remaining.id).not.toBe('r');
    expect(remaining).toMatchObject({ kind: 'recipe', recipe: null });
  });
});

describe('withRecipe', () => {
  it('copies the recipe and its reagents with names, icons and per-craft counts', () => {
    const block = withRecipe(emptyBlock(), testRecipe('Smelt Bronze'), TEST_CATALOG.items);
    expect(block.recipe).toEqual({
      spellId: 2659,
      name: 'Smelt Bronze',
      profession: 'Mining',
      icon: 'https://foreverdb.net/icons/133227.webp',
      makes: { itemId: 2841, name: 'Bronze Bar', count: 2 },
      reagents: [
        { itemId: 2840, name: 'Copper Bar', icon: 'https://foreverdb.net/icons/133216.webp', perCraft: 1 },
        { itemId: 3576, name: 'Tin Bar', icon: 'https://foreverdb.net/icons/133219.webp', perCraft: 1 },
      ],
    });
  });

  it('starts at ×1 but keeps an amount already entered', () => {
    expect(withRecipe(emptyBlock(), testRecipe('Smelt Bronze'), TEST_CATALOG.items).wanted).toBe(1);
    expect(withRecipe(emptyBlock(11), testRecipe('Smelt Bronze'), TEST_CATALOG.items).wanted).toBe(11);
  });

  it('restores removed reagents when the same recipe is picked again', () => {
    const picked = withRecipe(emptyBlock(), testRecipe('Smelt Bronze'), TEST_CATALOG.items);
    const trimmed = withoutReagent(picked, 2840);
    expect(trimmed.recipe?.reagents.map((reagent) => reagent.name)).toEqual(['Tin Bar']);
    const repicked = withRecipe(trimmed, testRecipe('Smelt Bronze'), TEST_CATALOG.items);
    expect(repicked.recipe?.reagents.map((reagent) => reagent.name)).toEqual(['Copper Bar', 'Tin Bar']);
  });

  it('names an item missing from the catalog by its id', () => {
    const block = withRecipe(emptyBlock(), testRecipe('Smelt Bronze'), {});
    expect(block.recipe?.reagents[0]).toEqual({ itemId: 2840, name: 'Item 2840', icon: null, perCraft: 1 });
  });
});

describe('withoutReagent', () => {
  it('leaves a block without a recipe unchanged', () => {
    const block = emptyBlock();
    expect(withoutReagent(block, 2840)).toBe(block);
  });
});

describe('item rows', () => {
  it('unlinks an item when its name is edited', () => {
    const linked = withLinkedItem(createItemRow(), {
      itemId: 2840,
      name: 'Copper Bar',
      icon: 'https://foreverdb.net/icons/133216.webp',
    });
    expect(linked).toMatchObject({ name: 'Copper Bar', itemId: 2840, icon: 'https://foreverdb.net/icons/133216.webp' });
    expect(withItemName(linked, 'Copper Bars')).toMatchObject({ name: 'Copper Bars', itemId: null, icon: null });
  });
});

describe('withCraftedRecipe', () => {
  it('fills a page that holds only an empty recipe field', () => {
    const empty = createRecipeBlock();
    const [block] = withCraftedRecipe([empty], testRecipe('Smelt Bronze'), TEST_CATALOG.items);
    expect(block).toMatchObject({ id: empty.id, kind: 'recipe', wanted: 2 });
    expect(block.kind === 'recipe' && block.recipe?.name).toBe('Smelt Bronze');
  });

  it('adds one craft after the existing entries', () => {
    const existing = recipeBlock('a', 'Bronze Tube', 1);
    const entries = withCraftedRecipe([existing], testRecipe('Rough Copper Vest'), TEST_CATALOG.items);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toBe(existing);
    expect(entries[1]).toMatchObject({ kind: 'recipe', wanted: 1 });
  });

  it('asks for one craft when a craft makes a fractional amount', () => {
    const recipe = { ...testRecipe('Smelt Bronze'), makes: { itemId: 2841, name: 'Bronze Bar', count: 1.5 } };
    const [block] = withCraftedRecipe([createRecipeBlock()], recipe, TEST_CATALOG.items);
    expect(block).toMatchObject({ wanted: 1 });
  });
});

describe('immutability', () => {
  it('never mutates frozen entries or prices', () => {
    const block = deepFreeze(withRecipe(emptyBlock(), testRecipe('Smelt Bronze'), TEST_CATALOG.items));
    const row = deepFreeze(createItemRow());
    const entries = deepFreeze([block, row]);
    const prices = deepFreeze({ 'name:copper bar': { gold: 0, silver: 1, copper: 0 } });

    expect(() => {
      withRecipe(block, testRecipe('Smelt Bronze'), TEST_CATALOG.items);
      withoutReagent(block, 2840);
      withItemName(row, 'Copper Bars');
      summarizeShopping(entries, prices);
    }).not.toThrow();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { Sheet } from '@/sheet/sheet';
import { loadSheet, saveSheet, STORAGE_KEY } from '@/sheet/storage';
import { coins, itemRow, recipeBlock } from '@/test/sheetFixtures';

type SavedShape = Record<string, unknown>;

const store = (value: unknown): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

const saved = (entries: unknown, prices: unknown = {}): SavedShape => ({ version: 2, entries, prices, muted: false });

const VALID_ROW: SavedShape = { kind: 'item', id: 'b', name: 'Linen Cloth', itemId: null, icon: null, quantity: 1 };

describe('sheet storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing was saved', () => {
    expect(loadSheet()).toBeNull();
  });

  it('round-trips a saved sheet', () => {
    const sheet: Sheet = {
      entries: [recipeBlock('r', 'Smelt Bronze', 11), itemRow('i', 'Copper Bar', 3, 2840)],
      prices: { 'name:copper bar': coins(10), 'name:linen cloth': coins(125) },
      muted: true,
    };
    saveSheet(sheet);
    expect(loadSheet()).toEqual(sheet);
  });

  it('discards version 1 data and removes it', () => {
    localStorage.setItem(
      'crafting-calculator:v1',
      JSON.stringify({ version: 1, title: 'Old', cards: [{ id: 'a', name: 'Copper Bar', quantity: 2 }], muted: true }),
    );
    expect(loadSheet()).toBeNull();
    expect(localStorage.getItem('crafting-calculator:v1')).toBeNull();
  });

  it('returns null for corrupted data, another version, or no entries', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadSheet()).toBeNull();
    store({ ...saved([VALID_ROW]), version: 3 });
    expect(loadSheet()).toBeNull();
    store(saved([]));
    expect(loadSheet()).toBeNull();
    store(saved('nope'));
    expect(loadSheet()).toBeNull();
  });

  it('drops invalid entries and keeps the others', () => {
    store(
      saved([
        { kind: 'item', id: 'a', name: 42, itemId: null, icon: null, quantity: 1 },
        { kind: 'spell', id: 'c' },
        { kind: 'recipe', id: 'd', recipe: { name: 1 }, wanted: 1 },
        VALID_ROW,
      ]),
    );
    expect(loadSheet()?.entries.map((entry) => entry.id)).toEqual(['b']);
  });

  it('keeps the first entry when ids repeat', () => {
    store(saved([VALID_ROW, { ...VALID_ROW, name: 'Copper Bar' }]));
    const sheet = loadSheet();
    expect(sheet?.entries).toHaveLength(1);
    expect(sheet?.entries[0]).toMatchObject({ name: 'Linen Cloth' });
  });

  it('clamps out-of-range amounts', () => {
    const block = { ...recipeBlock('r', 'Smelt Bronze', 1), wanted: 5_000 };
    store(saved([block, { ...VALID_ROW, quantity: 50_000 }]));
    expect(loadSheet()?.entries).toMatchObject([{ wanted: 999 }, { quantity: 9_999 }]);
  });

  it('drops an invalid reagent but keeps its recipe block', () => {
    const block = recipeBlock('r', 'Smelt Bronze', 1);
    const reagents = [...(block.recipe?.reagents ?? []), { itemId: 'x' }];
    store(saved([{ ...block, recipe: { ...block.recipe, reagents } }]));
    const loaded = loadSheet()?.entries[0];
    const names = loaded?.kind === 'recipe' ? loaded.recipe?.reagents.map((reagent) => reagent.name) : null;
    expect(names).toEqual(['Copper Bar', 'Tin Bar']);
  });

  it('keeps only well-formed prices and normalizes their coins', () => {
    store(
      saved([VALID_ROW], {
        'name:copper bar': { gold: 0, silver: 0, copper: 150 },
        bogus: { gold: 1, silver: 0, copper: 0 },
        'name:linen cloth': 'cheap',
      }),
    );
    expect(loadSheet()?.prices).toEqual({ 'name:copper bar': { gold: 0, silver: 1, copper: 50 } });
  });
});

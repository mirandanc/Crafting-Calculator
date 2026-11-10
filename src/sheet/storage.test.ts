import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sheet } from '@/sheet/sheet';
import { loadSheet, saveSheet, STORAGE_KEY } from '@/sheet/storage';
import { coins, itemRow, recipeBlock } from '@/test/sheetFixtures';

type SavedShape = Record<string, unknown>;

const store = (value: unknown): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

const V2_KEY = 'crafting-calculator:v2';

const storeV2 = (value: unknown): void => {
  localStorage.setItem(V2_KEY, JSON.stringify(value));
};

const saved = (entries: unknown, prices: unknown = {}): SavedShape => ({ version: 3, entries, prices, muted: false });

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

  it('keeps the entries of version 2 data but drops its prices once, and leaves it until the first save', () => {
    storeV2({ version: 2, entries: [VALID_ROW], prices: { 'name:linen cloth': coins(125) }, muted: true });
    const sheet = loadSheet();
    expect(sheet).toEqual({ entries: [itemRow('b', 'Linen Cloth', 1)], prices: {}, muted: true });
    expect(localStorage.getItem(V2_KEY)).not.toBeNull();
    if (sheet !== null) saveSheet(sheet);
    expect(localStorage.getItem(V2_KEY)).toBeNull();
    expect(loadSheet()).toEqual({ entries: [itemRow('b', 'Linen Cloth', 1)], prices: {}, muted: true });
  });

  it('prefers version 3 data over leftover version 2 data, and the next save removes the leftover', () => {
    storeV2({ version: 2, entries: [VALID_ROW], prices: {}, muted: false });
    store(saved([{ ...VALID_ROW, name: 'Wool Cloth' }], { 'name:wool cloth': coins(40) }));
    const sheet = loadSheet();
    expect(sheet?.entries[0]).toMatchObject({ name: 'Wool Cloth' });
    expect(sheet?.prices).toEqual({ 'name:wool cloth': coins(40) });
    if (sheet !== null) saveSheet(sheet);
    expect(localStorage.getItem(V2_KEY)).toBeNull();
  });

  it('falls back to version 2 data when version 3 data is corrupted, and the save replaces both', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    storeV2({ version: 2, entries: [VALID_ROW], prices: { 'name:linen cloth': coins(125) }, muted: false });
    const sheet = loadSheet();
    expect(sheet).toEqual({ entries: [itemRow('b', 'Linen Cloth', 1)], prices: {}, muted: false });
    if (sheet !== null) saveSheet(sheet);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toMatchObject({ version: 3, prices: {} });
    expect(loadSheet()).toEqual(sheet);
    expect(localStorage.getItem(V2_KEY)).toBeNull();
  });

  it('ignores version 2 data that is corrupted, empty or of another version, and the next save removes it', () => {
    const leftovers: string[] = ['{not json', JSON.stringify({ version: 2, entries: [], prices: {} }), JSON.stringify({ version: 1 })];
    for (const raw of leftovers) {
      localStorage.setItem(V2_KEY, raw);
      expect(loadSheet()).toBeNull();
      saveSheet({ entries: [itemRow('b', 'Linen Cloth', 1)], prices: {}, muted: false });
      expect(localStorage.getItem(V2_KEY)).toBeNull();
      localStorage.clear();
    }
  });

  it('keeps version 2 data when saving version 3 fails', () => {
    storeV2({ version: 2, entries: [VALID_ROW], prices: {}, muted: false });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      saveSheet({ entries: [itemRow('b', 'Linen Cloth', 1)], prices: {}, muted: false });
    } finally {
      setItem.mockRestore();
    }
    expect(localStorage.getItem(V2_KEY)).not.toBeNull();
    expect(loadSheet()?.entries.map((entry) => entry.id)).toEqual(['b']);
  });

  it('discards version 1 data and migrates version 2 data found alongside it', () => {
    localStorage.setItem('crafting-calculator:v1', JSON.stringify({ version: 1, title: 'Old', cards: [], muted: false }));
    storeV2({ version: 2, entries: [VALID_ROW], prices: {}, muted: false });
    expect(loadSheet()?.entries.map((entry) => entry.id)).toEqual(['b']);
    expect(localStorage.getItem('crafting-calculator:v1')).toBeNull();
  });

  it('saves under the version 3 key', () => {
    saveSheet({ entries: [itemRow('b', 'Linen Cloth', 1)], prices: {}, muted: false });
    expect(STORAGE_KEY).toBe('crafting-calculator:v3');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toMatchObject({ version: 3 });
  });

  it('returns null for corrupted data, another version, or no entries', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadSheet()).toBeNull();
    store({ ...saved([VALID_ROW]), version: 2 });
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
        'id:2840': { gold: 0, silver: 0, copper: 5 },
        'name:': { gold: 0, silver: 0, copper: 50 },
        'name:linen cloth': 'cheap',
      }),
    );
    expect(loadSheet()?.prices).toEqual({ 'name:copper bar': { gold: 0, silver: 1, copper: 50 } });
  });

  it('loads wanted and quantity below 1 as null rather than clamping them up', () => {
    const block = { ...recipeBlock('r', 'Smelt Bronze', 1), wanted: 0 };
    store(saved([block, { ...VALID_ROW, quantity: -5 }]));
    expect(loadSheet()?.entries).toMatchObject([{ wanted: null }, { quantity: null }]);
  });

  it('rejects an entry with an empty id', () => {
    store(saved([{ ...VALID_ROW, id: '' }, VALID_ROW]));
    expect(loadSheet()?.entries.map((entry) => entry.id)).toEqual(['b']);
  });

  it('de-duplicates reagents by itemId within a recipe, keeping the first', () => {
    const block = recipeBlock('r', 'Smelt Bronze', 1);
    const reagents = block.recipe?.reagents ?? [];
    const duplicated = [reagents[0], { ...reagents[0], perCraft: 99 }, reagents[1]];
    store(saved([{ ...block, recipe: { ...block.recipe, reagents: duplicated } }]));
    const loaded = loadSheet()?.entries[0];
    const perCrafts = loaded?.kind === 'recipe' ? loaded.recipe?.reagents.map((reagent) => reagent.perCraft) : null;
    expect(perCrafts).toEqual([1, 1]);
  });

  it('returns null when the saved root is null or an array', () => {
    store(null);
    expect(loadSheet()).toBeNull();
    store([saved([VALID_ROW])]);
    expect(loadSheet()).toBeNull();
  });

  it('treats NaN or negative coins as zero', () => {
    store(
      saved([VALID_ROW], {
        'name:linen cloth': { gold: Number.NaN, silver: -5, copper: 10 },
      }),
    );
    expect(loadSheet()?.prices).toEqual({ 'name:linen cloth': { gold: 0, silver: 0, copper: 10 } });
  });
});

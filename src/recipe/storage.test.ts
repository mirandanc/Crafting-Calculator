import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultRecipe, type Recipe } from '@/recipe/recipe';
import { loadRecipe, saveRecipe, STORAGE_KEY } from '@/recipe/storage';

describe('recipe storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing was saved', () => {
    expect(loadRecipe()).toBeNull();
  });

  it('round-trips a saved recipe', () => {
    const recipe: Recipe = { ...createDefaultRecipe(), title: 'Flask of the Titans', muted: true };
    saveRecipe(recipe);
    expect(loadRecipe()).toEqual(recipe);
  });

  it('returns null for corrupted data', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadRecipe()).toBeNull();
  });

  it('returns null for an unknown version or no cards', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, title: '', cards: [], muted: false }));
    expect(loadRecipe()).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, title: '', cards: [], muted: false }));
    expect(loadRecipe()).toBeNull();
  });

  it('drops a saved card missing its price and keeps the others', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        title: '',
        cards: [
          { id: 'a', name: 'Copper Bar', quantity: 2 },
          { id: 'b', name: 'Linen Cloth', quantity: 1, price: { gold: 0, silver: 0, copper: 75 } },
        ],
        muted: false,
      }),
    );
    const recipe = loadRecipe();
    expect(recipe?.cards).toHaveLength(1);
    expect(recipe?.cards[0].id).toBe('b');
  });

  it('drops a saved card with a non-string name', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        title: '',
        cards: [
          { id: 'a', name: 42, quantity: 2, price: { gold: 0, silver: 0, copper: 25 } },
          { id: 'b', name: 'Linen Cloth', quantity: 1, price: { gold: 0, silver: 0, copper: 75 } },
        ],
        muted: false,
      }),
    );
    expect(loadRecipe()?.cards.map((card) => card.id)).toEqual(['b']);
  });

  it('clamps an out-of-range saved quantity to the max', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        title: '',
        cards: [{ id: 'a', name: 'Copper Bar', quantity: 50_000, price: { gold: 0, silver: 0, copper: 25 } }],
        muted: false,
      }),
    );
    expect(loadRecipe()?.cards[0].quantity).toBe(9_999);
  });

  it('keeps the first saved card when ids are duplicated', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        title: '',
        cards: [
          { id: 'a', name: 'Copper Bar', quantity: 2, price: { gold: 0, silver: 0, copper: 25 } },
          { id: 'a', name: 'Linen Cloth', quantity: 1, price: { gold: 0, silver: 0, copper: 75 } },
        ],
        muted: false,
      }),
    );
    const recipe = loadRecipe();
    expect(recipe?.cards).toHaveLength(1);
    expect(recipe?.cards[0].name).toBe('Copper Bar');
  });

  it('returns null when every saved card is invalid', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        title: '',
        cards: [
          { id: 'a', name: 42, quantity: 2, price: { gold: 0, silver: 0, copper: 25 } },
          { name: 'Missing id', quantity: 1, price: { gold: 0, silver: 0, copper: 25 } },
        ],
        muted: false,
      }),
    );
    expect(loadRecipe()).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultRecipe, type Recipe } from '@/recipe/recipe';
import { loadRecipe, saveRecipe } from '@/recipe/storage';

const STORAGE_KEY = 'crafting-calculator:v1';

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
});

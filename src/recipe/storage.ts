import type { Recipe } from '@/recipe/recipe';

type SavedRecipe = Recipe & { version: 1 };

const STORAGE_KEY = 'crafting-calculator:v1';

export function loadRecipe(): Recipe | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const saved = JSON.parse(raw) as Partial<SavedRecipe>;
    if (saved.version !== 1 || !Array.isArray(saved.cards) || saved.cards.length === 0) return null;
    return {
      title: typeof saved.title === 'string' ? saved.title : '',
      cards: saved.cards,
      muted: saved.muted === true,
    };
  } catch {
    return null;
  }
}

export function saveRecipe(recipe: Recipe): void {
  try {
    const saved: SavedRecipe = { ...recipe, version: 1 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage blocked or full: the page keeps working, it just won't remember.
  }
}

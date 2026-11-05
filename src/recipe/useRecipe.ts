import { useEffect, useState } from 'react';
import { normalizeCoins, type Coins } from '@/money/money';
import {
  createDefaultRecipe,
  createEmptyCard,
  withoutCard,
  type ItemCard,
  type ItemCardPatch,
  type Recipe,
} from '@/recipe/recipe';
import { loadRecipe, saveRecipe } from '@/recipe/storage';

export type RecipeState = {
  recipe: Recipe;
  setTitle: (title: string) => void;
  addCard: () => void;
  updateCard: (id: string, patch: ItemCardPatch) => void;
  normalizeCardPrice: (id: string) => void;
  removeCard: (id: string) => void;
  clearAll: () => void;
  setMuted: (muted: boolean) => void;
};

const coinsEqual = (a: Coins, b: Coins): boolean => a.gold === b.gold && a.silver === b.silver && a.copper === b.copper;

export function useRecipe(): RecipeState {
  const [recipe, setRecipe] = useState<Recipe>(() => loadRecipe() ?? createDefaultRecipe());

  useEffect(() => {
    saveRecipe(recipe);
  }, [recipe]);

  const mapCard = (id: string, change: (card: ItemCard) => ItemCard) =>
    setRecipe((current) => {
      let changed = false;
      const cards = current.cards.map((card) => {
        if (card.id !== id) return card;
        const next = change(card);
        if (next !== card) changed = true;
        return next;
      });
      return changed ? { ...current, cards } : current;
    });

  return {
    recipe,
    setTitle: (title) => setRecipe((current) => ({ ...current, title })),
    addCard: () => setRecipe((current) => ({ ...current, cards: [...current.cards, createEmptyCard()] })),
    updateCard: (id, patch) => mapCard(id, (card) => ({ ...card, ...patch })),
    normalizeCardPrice: (id) =>
      mapCard(id, (card) => {
        const price = normalizeCoins(card.price);
        return coinsEqual(price, card.price) ? card : { ...card, price };
      }),
    removeCard: (id) => setRecipe((current) => ({ ...current, cards: withoutCard(current.cards, id) })),
    clearAll: () => setRecipe((current) => ({ ...current, title: '', cards: [createEmptyCard()] })),
    setMuted: (muted) => setRecipe((current) => ({ ...current, muted })),
  };
}

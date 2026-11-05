import { useEffect, useState } from 'react';
import { normalizeCoins } from '@/money/money';
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

export function useRecipe(): RecipeState {
  const [recipe, setRecipe] = useState<Recipe>(() => loadRecipe() ?? createDefaultRecipe());

  useEffect(() => {
    saveRecipe(recipe);
  }, [recipe]);

  const mapCard = (id: string, change: (card: ItemCard) => ItemCard) =>
    setRecipe((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.id === id ? change(card) : card)),
    }));

  return {
    recipe,
    setTitle: (title) => setRecipe((current) => ({ ...current, title })),
    addCard: () => setRecipe((current) => ({ ...current, cards: [...current.cards, createEmptyCard()] })),
    updateCard: (id, patch) => mapCard(id, (card) => ({ ...card, ...patch })),
    normalizeCardPrice: (id) => mapCard(id, (card) => ({ ...card, price: normalizeCoins(card.price) })),
    removeCard: (id) => setRecipe((current) => ({ ...current, cards: withoutCard(current.cards, id) })),
    clearAll: () => setRecipe((current) => ({ ...current, title: '', cards: [createEmptyCard()] })),
    setMuted: (muted) => setRecipe((current) => ({ ...current, muted })),
  };
}

import { normalizeCoins } from '@/money/money';
import { parseQuantity, type ItemCard, type Recipe } from '@/recipe/recipe';

type SavedRecipe = Recipe & { version: 1 };

export const STORAGE_KEY = 'crafting-calculator:v1';

function parseSavedCard(value: unknown): ItemCard | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return null;

  const rawQuantity = candidate.quantity;
  if (rawQuantity !== null && (typeof rawQuantity !== 'number' || !Number.isFinite(rawQuantity))) return null;
  const quantity = rawQuantity === null ? null : parseQuantity(String(rawQuantity));

  if (typeof candidate.price !== 'object' || candidate.price === null) return null;
  const rawPrice = candidate.price as Record<string, unknown>;
  const price = normalizeCoins({
    gold: typeof rawPrice.gold === 'number' ? rawPrice.gold : 0,
    silver: typeof rawPrice.silver === 'number' ? rawPrice.silver : 0,
    copper: typeof rawPrice.copper === 'number' ? rawPrice.copper : 0,
  });

  return { id: candidate.id, name: candidate.name, quantity, price };
}

function parseSavedCards(value: unknown): ItemCard[] | null {
  if (!Array.isArray(value)) return null;
  const seenIds = new Set<string>();
  const cards: ItemCard[] = [];
  for (const entry of value) {
    const card = parseSavedCard(entry);
    if (card === null || seenIds.has(card.id)) continue;
    seenIds.add(card.id);
    cards.push(card);
  }
  return cards.length === 0 ? null : cards;
}

export function loadRecipe(): Recipe | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const saved = JSON.parse(raw) as Partial<SavedRecipe>;
    if (saved.version !== 1) return null;
    const cards = parseSavedCards(saved.cards);
    if (cards === null) return null;
    return {
      title: typeof saved.title === 'string' ? saved.title : '',
      cards,
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

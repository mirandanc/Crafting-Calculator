import { toCopper, type Coins } from '@/money/money';

export type ItemCard = {
  id: string;
  name: string;
  quantity: number | null;
  price: Coins;
};

export type ItemCardPatch = Partial<Omit<ItemCard, 'id'>>;

export type Recipe = {
  title: string;
  cards: ItemCard[];
  muted: boolean;
};

export const MAX_QUANTITY = 9_999;

export function createEmptyCard(): ItemCard {
  return { id: crypto.randomUUID(), name: '', quantity: null, price: { gold: 0, silver: 0, copper: 0 } };
}

export function createDefaultRecipe(): Recipe {
  return { title: '', cards: [createEmptyCard()], muted: false };
}

export function parseQuantity(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(Math.trunc(value), 0), MAX_QUANTITY);
}

export function parseCoin(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

export function isCardFilled(card: ItemCard): boolean {
  return card.name.trim() !== '' && card.quantity !== null && card.quantity >= 1 && toCopper(card.price) > 0;
}

export function lineTotal(card: ItemCard): number {
  return (card.quantity ?? 0) * toCopper(card.price);
}

export function invoiceTotal(cards: ItemCard[]): number {
  return cards.reduce((sum, card) => sum + lineTotal(card), 0);
}

export function withoutCard(cards: ItemCard[], id: string): ItemCard[] {
  const remaining = cards.filter((card) => card.id !== id);
  return remaining.length === 0 ? [createEmptyCard()] : remaining;
}

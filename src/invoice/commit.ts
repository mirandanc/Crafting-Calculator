import { isCardFilled, type ItemCard } from '@/recipe/recipe';

export type CommitResult = {
  committed: string[];
  added: string[];
};

export function pruneCommitted(committed: string[], cards: ItemCard[]): string[] {
  const filledIds = new Set(cards.filter(isCardFilled).map((card) => card.id));
  const kept = committed.filter((id) => filledIds.has(id));
  return kept.length === committed.length ? committed : kept;
}

export function commitFilled(committed: string[], cards: ItemCard[]): CommitResult {
  const added = cards.filter((card) => isCardFilled(card) && !committed.includes(card.id)).map((card) => card.id);
  return { committed: added.length === 0 ? committed : [...committed, ...added], added };
}

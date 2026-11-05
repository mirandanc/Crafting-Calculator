import { useEffect, useRef, useState } from 'react';
import { commitFilled, pruneCommitted } from '@/invoice/commit';
import { isCardFilled, type ItemCard } from '@/recipe/recipe';

const COMMIT_DELAY_MS = 800;

export function useCommittedLines(cards: ItemCard[], onAdded: () => void): ItemCard[] {
  const [committedIds, setCommittedIds] = useState<string[]>(() => cards.filter(isCardFilled).map((card) => card.id));
  const committedRef = useRef<string[]>(committedIds);
  const onAddedRef = useRef(onAdded);

  useEffect(() => {
    onAddedRef.current = onAdded;
  }, [onAdded]);

  useEffect(() => {
    const pruned = pruneCommitted(committedRef.current, cards);
    if (pruned !== committedRef.current) {
      committedRef.current = pruned;
      setCommittedIds(pruned);
    }

    // Single shared debounce: editing any card restarts the 800 ms delay for every pending card.
    const timer = setTimeout(() => {
      const { committed, added } = commitFilled(committedRef.current, cards);
      if (added.length === 0) return;
      committedRef.current = committed;
      setCommittedIds(committed);
      onAddedRef.current();
    }, COMMIT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [cards]);

  // Filtering by isCardFilled too keeps rows correct during the render before the prune effect runs.
  return cards.filter((card) => committedIds.includes(card.id) && isCardFilled(card));
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { fullyPricedEntryIds, usesTypedPrice } from '@/sheet/fullyPriced';
import type { Entry, Prices } from '@/sheet/sheet';
import { announceReady, pruneAnnounced } from '@/sound/chime';

export type ChimeInputs = {
  entries: Entry[];
  /** Prices in effect: typed ones over market ones. */
  prices: Prices;
  /** Prices the player typed. */
  typedPrices: Prices;
  /** Changes when new market prices arrive (auction list or recipe book), null before. */
  marketStamp: string | null;
};

const CHIME_DELAY_MS = 800;

/**
 * Calls `onChime` once, 800 ms after the last change, when an entry has newly become fully priced by
 * the player's own typing. Entries priced by the market alone, or completed by market data arriving,
 * are marked as announced silently. A typed completion inside the same window as market data arriving
 * is also silent.
 *
 * Returns a function that makes the next check announce quietly, for a change that already chimed
 * on its own (a recipe sent from the market analysis). Any entry it completes counts as announced,
 * whether it landed in a new block or in the page's lone empty one.
 */
export function useChimeOnFullyPriced({ entries, prices, typedPrices, marketStamp }: ChimeInputs, onChime: () => void): () => void {
  const [initiallyReady] = useState(() => fullyPricedEntryIds(entries, prices));
  const announcedRef = useRef<string[]>(initiallyReady);
  const onChimeRef = useRef(onChime);
  const lastStampRef = useRef(marketStamp);
  const marketChangedRef = useRef(false);
  const quietRef = useRef(false);

  useEffect(() => {
    onChimeRef.current = onChime;
  }, [onChime]);

  useEffect(() => {
    if (marketStamp !== lastStampRef.current) {
      lastStampRef.current = marketStamp;
      marketChangedRef.current = true;
    }
    const ready = fullyPricedEntryIds(entries, prices);

    // One shared debounce: any change restarts the delay for everything pending. Pruning happens
    // inside the timer, not here, so an entry that briefly dips out of "ready" between renders
    // (e.g. clearing a field to retype it) within the same window isn't forgotten and re-chimed.
    const timer = setTimeout(() => {
      const pruned = pruneAnnounced(announcedRef.current, ready);
      const { announced, added } = announceReady(pruned, ready);
      announcedRef.current = announced;
      const quiet = marketChangedRef.current || quietRef.current;
      marketChangedRef.current = false;
      quietRef.current = false;
      if (quiet) return;
      const typedAdded = added.some((id) => {
        const entry = entries.find((candidate) => candidate.id === id);
        return entry !== undefined && usesTypedPrice(entry, typedPrices);
      });
      if (typedAdded) onChimeRef.current();
    }, CHIME_DELAY_MS);

    return () => clearTimeout(timer);
  }, [entries, prices, typedPrices, marketStamp]);

  return useCallback(() => {
    quietRef.current = true;
  }, []);
}

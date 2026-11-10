import { useEffect, useRef, useState } from 'react';
import { fullyPricedEntryIds, usesTypedPrice } from '@/sheet/fullyPriced';
import type { Entry, Prices } from '@/sheet/sheet';
import { announceReady, pruneAnnounced } from '@/sound/chime';

export type ChimeInputs = {
  entries: Entry[];
  /** Prices in effect: typed ones over auction ones. */
  prices: Prices;
  /** Prices the player typed. */
  typedPrices: Prices;
  /** Changes when a new auction price list arrives (its updatedAt), null before. */
  auctionStamp: string | null;
};

const CHIME_DELAY_MS = 800;

/**
 * Calls `onChime` once, 800 ms after the last change, when an entry has newly become fully priced by
 * the player's own typing. Entries priced by the auction alone, or completed by auction data arriving,
 * are marked as announced silently.
 */
export function useChimeOnFullyPriced({ entries, prices, typedPrices, auctionStamp }: ChimeInputs, onChime: () => void): void {
  const [initiallyReady] = useState(() => fullyPricedEntryIds(entries, prices));
  const announcedRef = useRef<string[]>(initiallyReady);
  const onChimeRef = useRef(onChime);
  const lastStampRef = useRef(auctionStamp);
  const auctionChangedRef = useRef(false);

  useEffect(() => {
    onChimeRef.current = onChime;
  }, [onChime]);

  useEffect(() => {
    if (auctionStamp !== lastStampRef.current) {
      lastStampRef.current = auctionStamp;
      auctionChangedRef.current = true;
    }
    const ready = fullyPricedEntryIds(entries, prices);

    // One shared debounce: any change restarts the delay for everything pending. Pruning happens
    // inside the timer, not here, so an entry that briefly dips out of "ready" between renders
    // (e.g. clearing a field to retype it) within the same window isn't forgotten and re-chimed.
    const timer = setTimeout(() => {
      const pruned = pruneAnnounced(announcedRef.current, ready);
      const { announced, added } = announceReady(pruned, ready);
      announcedRef.current = announced;
      const auctionChanged = auctionChangedRef.current;
      auctionChangedRef.current = false;
      if (auctionChanged) return;
      const typedAdded = added.some((id) => {
        const entry = entries.find((candidate) => candidate.id === id);
        return entry !== undefined && usesTypedPrice(entry, typedPrices);
      });
      if (typedAdded) onChimeRef.current();
    }, CHIME_DELAY_MS);

    return () => clearTimeout(timer);
  }, [entries, prices, typedPrices, auctionStamp]);
}

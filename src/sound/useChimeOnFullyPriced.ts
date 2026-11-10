import { useEffect, useRef, useState } from 'react';
import { fullyPricedEntryIds } from '@/sheet/fullyPriced';
import type { Entry, Prices } from '@/sheet/sheet';
import { announceReady, pruneAnnounced } from '@/sound/chime';

const CHIME_DELAY_MS = 800;

/** Calls `onChime` once, 800 ms after the last change, when any entry has newly become fully priced. */
export function useChimeOnFullyPriced(entries: Entry[], prices: Prices, onChime: () => void): void {
  const [initiallyReady] = useState(() => fullyPricedEntryIds(entries, prices));
  const announcedRef = useRef<string[]>(initiallyReady);
  const onChimeRef = useRef(onChime);

  useEffect(() => {
    onChimeRef.current = onChime;
  }, [onChime]);

  useEffect(() => {
    const ready = fullyPricedEntryIds(entries, prices);

    // One shared debounce: any change restarts the delay for everything pending. Pruning happens
    // inside the timer, not here, so an entry that briefly dips out of "ready" between renders
    // (e.g. clearing a field to retype it) within the same window isn't forgotten and re-chimed.
    const timer = setTimeout(() => {
      const pruned = pruneAnnounced(announcedRef.current, ready);
      const { announced, added } = announceReady(pruned, ready);
      announcedRef.current = announced;
      if (added.length > 0) onChimeRef.current();
    }, CHIME_DELAY_MS);

    return () => clearTimeout(timer);
  }, [entries, prices]);
}

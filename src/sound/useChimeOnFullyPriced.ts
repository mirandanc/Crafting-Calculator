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
    announcedRef.current = pruneAnnounced(announcedRef.current, ready);

    // One shared debounce: any change restarts the delay for everything pending.
    const timer = setTimeout(() => {
      const { announced, added } = announceReady(announcedRef.current, ready);
      if (added.length === 0) return;
      announcedRef.current = announced;
      onChimeRef.current();
    }, CHIME_DELAY_MS);

    return () => clearTimeout(timer);
  }, [entries, prices]);
}

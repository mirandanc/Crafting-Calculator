import { useEffect, useRef, useState } from 'react';
import { fetchItems, pickItemMatches, type ForeverItem } from '@/foreverdb/itemSearch';
import { isSearchable } from '@/search/rank';

const SEARCH_DELAY_MS = 300;

/**
 * Searches ForeverDB items 300 ms after the query stops changing. Pass '' to stay idle (for example
 * when the row is already linked). `onReachable` hears true after a success and false after a failure.
 */
export function useItemSearch(query: string, onReachable: (reachable: boolean) => void): ForeverItem[] {
  const [results, setResults] = useState<ForeverItem[]>([]);
  const onReachableRef = useRef(onReachable);

  useEffect(() => {
    onReachableRef.current = onReachable;
  }, [onReachable]);

  useEffect(() => {
    if (!isSearchable(query)) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchItems(query, controller.signal).then(
        (items) => {
          if (controller.signal.aborted) return;
          setResults(pickItemMatches(items, query));
          onReachableRef.current(true);
        },
        () => {
          // An aborted request is not a lost connection: the user simply kept typing.
          if (controller.signal.aborted) return;
          setResults([]);
          onReachableRef.current(false);
        },
      );
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return isSearchable(query) ? results : [];
}

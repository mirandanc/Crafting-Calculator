import { useEffect, useRef, useState } from 'react';
import { fetchItems, ItemSearchHttpError, MAX_QUERY_LENGTH, pickItemMatches, type ForeverItem } from '@/foreverdb/itemSearch';
import { isSearchable } from '@/search/rank';

const SEARCH_DELAY_MS = 300;

type SearchState = {
  query: string;
  items: ForeverItem[];
};

const EMPTY_STATE: SearchState = { query: '', items: [] };

function isQueryToSearch(trimmedQuery: string): boolean {
  return isSearchable(trimmedQuery) && trimmedQuery.length <= MAX_QUERY_LENGTH;
}

function isClientError(error: unknown): boolean {
  return error instanceof ItemSearchHttpError && error.status >= 400 && error.status < 500;
}

/**
 * Searches ForeverDB items 300 ms after the trimmed query stops changing. Pass '' to stay idle (for
 * example when the row is already linked). `onReachable` hears true after a success (including a 4xx,
 * which just means no results) and false after a 5xx or a network failure.
 */
export function useItemSearch(query: string, onReachable: (reachable: boolean) => void): ForeverItem[] {
  const trimmedQuery = query.trim();
  const [state, setState] = useState<SearchState>(EMPTY_STATE);
  const onReachableRef = useRef(onReachable);

  useEffect(() => {
    onReachableRef.current = onReachable;
  }, [onReachable]);

  useEffect(() => {
    if (!isQueryToSearch(trimmedQuery)) return undefined;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchItems(trimmedQuery, controller.signal)
        .then((items) => {
          if (cancelled) return;
          setState({ query: trimmedQuery, items: pickItemMatches(items, trimmedQuery) });
          onReachableRef.current(true);
        })
        .catch((error: unknown) => {
          // An aborted request is not a lost connection: the user simply kept typing or moved away.
          if (cancelled) return;
          setState({ query: trimmedQuery, items: [] });
          onReachableRef.current(isClientError(error));
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery]);

  if (!isQueryToSearch(trimmedQuery) || state.query !== trimmedQuery) return [];
  return state.items;
}

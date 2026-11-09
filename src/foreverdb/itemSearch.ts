import { MAX_RESULTS, rankByName } from '@/search/rank';

/** The fields the app reads from ForeverDB's item list (the Worker passes the full answer through). */
export type ForeverItem = {
  id: number;
  name: string;
  icon: string;
  speculation: boolean;
  betaEvent: boolean;
};

type ItemListResponse = {
  data: ForeverItem[];
};

export async function fetchItems(query: string, signal: AbortSignal): Promise<ForeverItem[]> {
  const response = await fetch(`/api/items?q=${encodeURIComponent(query.trim())}`, { signal });
  if (!response.ok) throw new Error(`Item search failed: ${response.status}`);
  const body = (await response.json()) as ItemListResponse;
  return body.data;
}

/** ForeverDB sorts by id, not relevance: drop uncertain or event-only items, then rank like the recipe search. */
export function pickItemMatches(items: ForeverItem[], query: string): ForeverItem[] {
  return rankByName(
    items.filter((item) => !item.speculation && !item.betaEvent),
    query,
    MAX_RESULTS,
  );
}

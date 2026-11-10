import { MAX_RESULTS, rankByName } from '@/search/rank';

/** Mirrors the Worker's limit on `q` (see worker/proxy.ts); longer queries are not sent. */
export const MAX_QUERY_LENGTH = 80;

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

/** A non-OK HTTP answer from the Worker; `status` lets callers tell a client error from a server one. */
export class ItemSearchHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Item search failed: ${status}`);
    this.status = status;
  }
}

export async function fetchItems(query: string, signal: AbortSignal): Promise<ForeverItem[]> {
  const response = await fetch(`/api/items?q=${encodeURIComponent(query.trim())}`, { signal });
  if (!response.ok) throw new ItemSearchHttpError(response.status);
  const body = (await response.json()) as ItemListResponse;
  if (!Array.isArray(body.data)) throw new Error('Item search failed: invalid response');
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

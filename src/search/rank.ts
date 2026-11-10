export const MIN_QUERY_LENGTH = 3;
export const MAX_RESULTS = 8;

type Named = {
  name: string;
};

type Ranked<T> = {
  item: T;
  tier: number;
};

const EXACT = 0;
const PREFIX = 1;
const CONTAINS = 2;

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}

function matchTier(name: string, needle: string): number | null {
  const haystack = name.toLowerCase();
  if (haystack === needle) return EXACT;
  if (haystack.startsWith(needle)) return PREFIX;
  if (haystack.includes(needle)) return CONTAINS;
  return null;
}

/**
 * Case-insensitive ranking: exact matches, then prefix, then contains; anything else is dropped.
 * Inside a tier names sort alphabetically; identical names keep their input order (sort is stable).
 */
export function rankByName<T extends Named>(items: T[], query: string, limit: number): T[] {
  if (!isSearchable(query)) return [];
  const needle = query.trim().toLowerCase();
  const ranked: Ranked<T>[] = [];
  for (const item of items) {
    const tier = matchTier(item.name, needle);
    if (tier !== null) ranked.push({ item, tier });
  }
  ranked.sort((a, b) => a.tier - b.tier || a.item.name.localeCompare(b.item.name, 'en'));
  return ranked.slice(0, limit).map((entry) => entry.item);
}

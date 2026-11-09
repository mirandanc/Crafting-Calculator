import { describe, expect, it } from 'vitest';
import { isSearchable, MAX_RESULTS, MIN_QUERY_LENGTH, rankByName } from '@/search/rank';

type NamedThing = {
  id: number;
  name: string;
};

const things = (...names: string[]): NamedThing[] => names.map((name, index) => ({ id: index + 1, name }));
const names = (items: NamedThing[]): string[] => items.map((item) => item.name);

describe('isSearchable', () => {
  it('needs at least 3 letters after trimming', () => {
    expect(MIN_QUERY_LENGTH).toBe(3);
    expect(isSearchable('  br ')).toBe(false);
    expect(isSearchable('bro')).toBe(true);
  });
});

describe('rankByName', () => {
  it('returns nothing for a query that is too short', () => {
    expect(rankByName(things('Bronze Bar'), 'br', MAX_RESULTS)).toEqual([]);
  });

  it('orders exact, then prefix, then contains, ignoring case', () => {
    const result = rankByName(things('Smelt Bronze', 'Bronze Bar', 'bronze', 'Bronze Axe'), 'BRONZE', MAX_RESULTS);
    expect(names(result)).toEqual(['bronze', 'Bronze Axe', 'Bronze Bar', 'Smelt Bronze']);
  });

  it('drops names that do not contain the query', () => {
    expect(names(rankByName(things('Copper Bar', 'Tin Bar'), 'copper', MAX_RESULTS))).toEqual(['Copper Bar']);
  });

  it('keeps at most the limit', () => {
    const many = things(...Array.from({ length: 12 }, (_, index) => `Copper ${index}`));
    expect(MAX_RESULTS).toBe(8);
    expect(rankByName(many, 'copper', MAX_RESULTS)).toHaveLength(8);
  });

  it('keeps the input order for identical names', () => {
    const result = rankByName(things('Radiant Gloves', 'Radiant Gloves'), 'radiant', MAX_RESULTS);
    expect(result.map((item) => item.id)).toEqual([1, 2]);
  });

  it('trims the query', () => {
    expect(names(rankByName(things('Tin Bar'), '  tin  ', MAX_RESULTS))).toEqual(['Tin Bar']);
  });
});

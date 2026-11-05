import { describe, expect, it } from 'vitest';
import { commitFilled, pruneCommitted } from '@/invoice/commit';
import type { ItemCard } from '@/recipe/recipe';

const filled = (id: string): ItemCard => ({ id, name: 'Copper Bar', quantity: 2, price: { gold: 0, silver: 0, copper: 25 } });
const empty = (id: string): ItemCard => ({ id, name: '', quantity: null, price: { gold: 0, silver: 0, copper: 0 } });

describe('pruneCommitted', () => {
  it('drops ids whose card is no longer filled or no longer exists', () => {
    expect(pruneCommitted(['a', 'b', 'gone'], [filled('a'), empty('b')])).toEqual(['a']);
  });

  it('returns the same array when nothing changes', () => {
    const committed = ['a'];
    expect(pruneCommitted(committed, [filled('a')])).toBe(committed);
  });
});

describe('commitFilled', () => {
  it('adds newly filled cards in card order and reports them', () => {
    expect(commitFilled(['b'], [filled('a'), filled('b'), empty('c'), filled('d')])).toEqual({
      committed: ['b', 'a', 'd'],
      added: ['a', 'd'],
    });
  });

  it('returns the same array and no additions when every filled card is committed', () => {
    const committed = ['a'];
    const result = commitFilled(committed, [filled('a'), empty('b')]);
    expect(result.committed).toBe(committed);
    expect(result.added).toEqual([]);
  });
});

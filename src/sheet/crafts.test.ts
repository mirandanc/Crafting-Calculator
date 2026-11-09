import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from '@/recipes/catalog';
import { craftNote, planCrafts, reagentQuantity } from '@/sheet/crafts';

const BRONZE_BAR: CatalogProduct = { itemId: 2841, name: 'Bronze Bar', count: 2 };
const COPPER_VEST: CatalogProduct = { itemId: 10421, name: 'Rough Copper Vest', count: 1 };

describe('planCrafts', () => {
  it('rounds crafts up and reports the extra items', () => {
    expect(planCrafts(11, BRONZE_BAR)).toEqual({ crafts: 6, produced: 12, extra: 1 });
  });

  it('has no extra on an exact multiple', () => {
    expect(planCrafts(10, BRONZE_BAR)).toEqual({ crafts: 5, produced: 10, extra: 0 });
  });

  it('crafts once per item for single-yield recipes', () => {
    expect(planCrafts(3, COPPER_VEST)).toEqual({ crafts: 3, produced: 3, extra: 0 });
  });

  it('treats ×N as casts when the recipe makes no item', () => {
    expect(planCrafts(4, null)).toEqual({ crafts: 4, produced: null, extra: 0 });
  });

  it('plans nothing while ×N is empty or zero', () => {
    expect(planCrafts(null, BRONZE_BAR)).toEqual({ crafts: 0, produced: null, extra: 0 });
    expect(planCrafts(0, BRONZE_BAR)).toEqual({ crafts: 0, produced: null, extra: 0 });
  });
});

describe('craftNote', () => {
  it('explains multi-yield recipes', () => {
    expect(craftNote(planCrafts(11, BRONZE_BAR), BRONZE_BAR)).toBe('6 crafts → 12 Bronze Bar (1 extra)');
    expect(craftNote(planCrafts(1, BRONZE_BAR), BRONZE_BAR)).toBe('1 craft → 2 Bronze Bar (1 extra)');
    expect(craftNote(planCrafts(10, BRONZE_BAR), BRONZE_BAR)).toBe('5 crafts → 10 Bronze Bar');
  });

  it('says nothing for single-yield recipes, casts, or no crafts', () => {
    expect(craftNote(planCrafts(3, COPPER_VEST), COPPER_VEST)).toBeNull();
    expect(craftNote(planCrafts(3, null), null)).toBeNull();
    expect(craftNote(planCrafts(null, BRONZE_BAR), BRONZE_BAR)).toBeNull();
  });
});

describe('reagentQuantity', () => {
  it('multiplies the per-craft count by the crafts', () => {
    expect(reagentQuantity(4, planCrafts(3, COPPER_VEST))).toBe(12);
    expect(reagentQuantity(1, planCrafts(11, BRONZE_BAR))).toBe(6);
  });
});

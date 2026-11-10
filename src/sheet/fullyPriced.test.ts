import { describe, expect, it } from 'vitest';
import { fullyPricedEntryIds, isEntryFullyPriced } from '@/sheet/fullyPriced';
import { createRecipeBlock, withoutReagent, type Prices } from '@/sheet/sheet';
import { coins, itemRow, recipeBlock } from '@/test/sheetFixtures';

const BOTH_BARS: Prices = { 'name:copper bar': coins(10), 'name:tin bar': coins(5) };

describe('isEntryFullyPriced', () => {
  it('needs a name, a quantity and a price on an item row', () => {
    const prices: Prices = { 'name:linen cloth': coins(25) };
    expect(isEntryFullyPriced(itemRow('a', 'Linen Cloth', 2), prices)).toBe(true);
    expect(isEntryFullyPriced(itemRow('a', ' ', 2), prices)).toBe(false);
    expect(isEntryFullyPriced(itemRow('a', 'Linen Cloth', 0), prices)).toBe(false);
    expect(isEntryFullyPriced(itemRow('a', 'Linen Cloth', 2), {})).toBe(false);
  });

  it("a linked row uses its name's price", () => {
    expect(isEntryFullyPriced(itemRow('a', 'Copper Bar', 1, 2840), BOTH_BARS)).toBe(true);
  });

  it('needs every reagent of a recipe priced', () => {
    expect(isEntryFullyPriced(recipeBlock('r', 'Smelt Bronze', 1), BOTH_BARS)).toBe(true);
    expect(isEntryFullyPriced(recipeBlock('r', 'Smelt Bronze', 1), { 'name:copper bar': coins(10) })).toBe(false);
  });

  it('ignores removed reagents', () => {
    const block = withoutReagent(recipeBlock('r', 'Smelt Bronze', 1), 3576);
    expect(isEntryFullyPriced(block, { 'name:copper bar': coins(10) })).toBe(true);
  });

  it('is false without a recipe, without ×N, or with no reagents left', () => {
    expect(isEntryFullyPriced(createRecipeBlock(), BOTH_BARS)).toBe(false);
    expect(isEntryFullyPriced(recipeBlock('r', 'Smelt Bronze', null), BOTH_BARS)).toBe(false);
    const empty = withoutReagent(withoutReagent(recipeBlock('r', 'Smelt Bronze', 1), 2840), 3576);
    expect(isEntryFullyPriced(empty, BOTH_BARS)).toBe(false);
  });
});

describe('fullyPricedEntryIds', () => {
  it('lists fully priced entries in page order', () => {
    const entries = [itemRow('a', 'Copper Bar', 1, 2840), createRecipeBlock(), recipeBlock('c', 'Smelt Bronze', 2)];
    expect(fullyPricedEntryIds(entries, BOTH_BARS)).toEqual(['a', 'c']);
  });
});

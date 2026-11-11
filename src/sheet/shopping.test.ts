import { describe, expect, it } from 'vitest';
import { GOLD_CAP_COPPER } from '@/money/money';
import { createRecipeBlock, MAX_QUANTITY, type Prices } from '@/sheet/sheet';
import { summarizeShopping } from '@/sheet/shopping';
import { coins, itemRow, recipeBlock } from '@/test/sheetFixtures';

const PRICES: Prices = { 'name:copper bar': coins(10), 'name:tin bar': coins(5) };

describe('summarizeShopping', () => {
  it('is empty for a fresh page', () => {
    expect(summarizeShopping([createRecipeBlock()], {})).toEqual({ lines: [], total: 0, unpricedCount: 0 });
  });

  it('lists each reagent times the crafts, with its recipe as source', () => {
    expect(summarizeShopping([recipeBlock('a', 'Smelt Bronze', 11)], PRICES)).toEqual({
      lines: [
        {
          key: 'name:copper bar',
          name: 'Copper Bar',
          icon: 'https://foreverdb.net/icons/133216.webp',
          itemId: 2840,
          quantity: 6,
          unitPrice: 10,
          sources: ['Smelt Bronze'],
        },
        {
          key: 'name:tin bar',
          name: 'Tin Bar',
          icon: 'https://foreverdb.net/icons/133219.webp',
          itemId: 3576,
          quantity: 6,
          unitPrice: 5,
          sources: ['Smelt Bronze'],
        },
      ],
      total: 90,
      unpricedCount: 0,
    });
  });

  it('merges one item used by two recipes and lists both sources', () => {
    const { lines } = summarizeShopping([recipeBlock('a', 'Smelt Bronze', 2), recipeBlock('b', 'Rough Copper Vest', 1)], PRICES);
    expect(lines.map((line) => [line.name, line.quantity, line.sources])).toEqual([
      ['Copper Bar', 5, ['Smelt Bronze', 'Rough Copper Vest']],
      ['Tin Bar', 1, ['Smelt Bronze']],
    ]);
  });

  it('names a recipe once even when it appears twice', () => {
    const { lines } = summarizeShopping([recipeBlock('a', 'Smelt Bronze', 2), recipeBlock('b', 'Smelt Bronze', 2)], PRICES);
    expect(lines[0]).toMatchObject({ name: 'Copper Bar', quantity: 2, sources: ['Smelt Bronze'] });
  });

  it('merges a linked item row with the same reagent by name', () => {
    const { lines } = summarizeShopping([recipeBlock('a', 'Smelt Bronze', 2), itemRow('i', 'Copper Bar', 3, 2840)], PRICES);
    expect(lines[0]).toMatchObject({ key: 'name:copper bar', quantity: 4, sources: ['Smelt Bronze'] });
  });

  it('merges typed and linked rows by case-insensitive name', () => {
    const { lines } = summarizeShopping(
      [
        itemRow('a', 'Linen Cloth', 2),
        itemRow('b', ' linen cloth ', 3),
        itemRow('c', 'copper bar', 1),
        recipeBlock('d', 'Rough Copper Vest', 1),
      ],
      {},
    );
    expect(lines.map((line) => [line.key, line.name, line.quantity])).toEqual([
      ['name:linen cloth', 'Linen Cloth', 5],
      ['name:copper bar', 'Copper Bar', 5],
    ]);
  });

  it('skips blank rows, missing quantities and recipes without crafts', () => {
    const entries = [
      createRecipeBlock(),
      itemRow('a', '  ', 2),
      itemRow('b', 'Linen Cloth', null),
      itemRow('c', 'Linen Cloth', 0),
      recipeBlock('d', 'Smelt Bronze', null),
    ];
    expect(summarizeShopping(entries, PRICES).lines).toEqual([]);
  });

  it('shows unpriced lines, counts them, and leaves them out of the total', () => {
    const summary = summarizeShopping([recipeBlock('a', 'Smelt Bronze', 2)], { 'name:copper bar': coins(10) });
    expect(summary.lines.map((line) => line.unitPrice)).toEqual([10, 0]);
    expect(summary.total).toBe(10);
    expect(summary.unpricedCount).toBe(1);
  });

  it("a linked member's icon and spelling win", () => {
    // The typed row arrives first and establishes the line unlinked; the linked reagent that follows
    // takes over the canonical name and icon, even though the line already had a (wrong-cased) name.
    const { lines } = summarizeShopping([itemRow('t', 'copper bar', 1), recipeBlock('a', 'Smelt Bronze', 2)], {});
    expect(lines[0]).toMatchObject({ name: 'Copper Bar', icon: 'https://foreverdb.net/icons/133216.webp', itemId: 2840, quantity: 2 });
  });

  it('a linked line first, then a typed duplicate: the spelling stays the linked one', () => {
    const { lines } = summarizeShopping([recipeBlock('a', 'Smelt Bronze', 2), itemRow('t', 'COPPER bar', 1)], {});
    expect(lines[0]).toMatchObject({ name: 'Copper Bar', icon: 'https://foreverdb.net/icons/133216.webp', quantity: 2 });
  });

  it('a linked reagent with no icon still sets the spelling', () => {
    const { lines } = summarizeShopping(
      [recipeBlock('e', 'Enchant Bracer - Inferior Stamina', 1), itemRow('t', 'MOTE OF MAGIC', 1)],
      {},
    );
    expect(lines[0]).toMatchObject({ name: 'Mote of Magic', icon: null, quantity: 2 });
  });

  it('clamps the total at Number.MAX_SAFE_INTEGER', () => {
    const entries = Array.from({ length: 10 }, (_, index) => itemRow(`row-${index}`, `Thing ${index}`, MAX_QUANTITY));
    const prices: Prices = Object.fromEntries(entries.map((_, index) => [`name:thing ${index}`, coins(GOLD_CAP_COPPER)]));
    expect(summarizeShopping(entries, prices).total).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('keeps merged and multiplied quantities uncapped at ×999, while the money total still clamps', () => {
    const entries = [
      recipeBlock('a', 'Rough Copper Vest', 999),
      recipeBlock('b', 'Rough Copper Vest', 999),
      recipeBlock('c', 'Rough Copper Vest', 999),
      ...Array.from({ length: 10 }, (_, index) => itemRow(`row-${index}`, `Thing ${index}`, MAX_QUANTITY)),
    ];
    const prices: Prices = {
      'name:copper bar': coins(10),
      ...Object.fromEntries(entries.slice(3).map((_, index) => [`name:thing ${index}`, coins(GOLD_CAP_COPPER)])),
    };
    const summary = summarizeShopping(entries, prices);
    const copperLine = summary.lines.find((line) => line.key === 'name:copper bar');
    expect(copperLine?.quantity).toBe(999 * 4 * 3);
    expect(copperLine?.quantity).toBeGreaterThan(MAX_QUANTITY);
    expect(summary.total).toBe(Number.MAX_SAFE_INTEGER);
  });
});

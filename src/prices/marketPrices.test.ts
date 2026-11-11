import { describe, expect, it } from 'vitest';
import { marketPriceOf, marketPricesByKey, priceHintOf, withMarketPrices, type ItemPrices, type MarketPricesByKey } from '@/prices/marketPrices';
import { createRecipeBlock, type Prices } from '@/sheet/sheet';
import { coins, itemRow, recipeBlock } from '@/test/sheetFixtures';

const AUCTION: ItemPrices = { '2840': 113, '3576': 250 };

describe('marketPriceOf', () => {
  it('takes the vendor price when it is cheaper', () => {
    expect(marketPriceOf(3576, { '3576': 250 }, { '3576': 200 })).toEqual({ copper: 200, source: 'vendor' });
  });

  it('keeps the auction price when it is cheaper or equal', () => {
    expect(marketPriceOf(3576, { '3576': 150 }, { '3576': 200 })).toEqual({ copper: 150, source: 'auction' });
    expect(marketPriceOf(3576, { '3576': 200 }, { '3576': 200 })).toEqual({ copper: 200, source: 'auction' });
  });

  it('uses whichever exists, or nothing', () => {
    expect(marketPriceOf(1, {}, { '1': 5 })).toEqual({ copper: 5, source: 'vendor' });
    expect(marketPriceOf(1, { '1': 9 }, {})).toEqual({ copper: 9, source: 'auction' });
    expect(marketPriceOf(1, {}, {})).toBeNull();
  });
});

describe('marketPricesByKey', () => {
  it('maps each linked entry name to its auction price', () => {
    const entries = [recipeBlock('a', 'Smelt Bronze', 2), itemRow('i', 'Linen Cloth', 1, 2589), itemRow('t', 'typed', 1)];
    expect(marketPricesByKey(entries, AUCTION, {})).toEqual({
      'name:copper bar': { copper: 113, source: 'auction' },
      'name:tin bar': { copper: 250, source: 'auction' },
    });
  });

  it('is empty without entries or without prices', () => {
    expect(marketPricesByKey([createRecipeBlock()], AUCTION, {})).toEqual({});
    expect(marketPricesByKey([recipeBlock('a', 'Smelt Bronze', 2)], {}, {})).toEqual({});
  });

  it('lets the first linked entry of a name set its price', () => {
    const entries = [itemRow('a', 'Copper Bar', 1, 2840), itemRow('b', 'Copper Bar', 1, 3576)];
    expect(marketPricesByKey(entries, AUCTION, {})).toEqual({ 'name:copper bar': { copper: 113, source: 'auction' } });
  });

  it('treats names that differ only in case as one key', () => {
    const entries = [itemRow('a', 'copper bar', 1, 3576), recipeBlock('b', 'Smelt Bronze', 1)];
    expect(marketPricesByKey(entries, AUCTION, {})).toEqual({
      'name:copper bar': { copper: 250, source: 'auction' },
      'name:tin bar': { copper: 250, source: 'auction' },
    });
  });

  it('skips a linked item row with a blank name', () => {
    expect(marketPricesByKey([itemRow('a', '  ', 1, 2840)], AUCTION, {})).toEqual({});
  });
});

describe('marketPricesByKey with vendor prices', () => {
  it('prices linked names from the cheaper source', () => {
    const entries = [recipeBlock('a', 'Smelt Bronze', 2)];
    expect(marketPricesByKey(entries, { '2840': 113, '3576': 250 }, { '3576': 200 })).toEqual({
      'name:copper bar': { copper: 113, source: 'auction' },
      'name:tin bar': { copper: 200, source: 'vendor' },
    });
  });
});

describe('withMarketPrices', () => {
  it('fills unpriced names from the market and lets typed prices win', () => {
    const typed: Prices = { 'name:tin bar': coins(300) };
    const byKey: MarketPricesByKey = {
      'name:copper bar': { copper: 113, source: 'auction' },
      'name:tin bar': { copper: 250, source: 'vendor' },
    };
    expect(withMarketPrices(typed, byKey)).toEqual({
      'name:copper bar': coins(113),
      'name:tin bar': coins(300),
    });
  });

  it('returns the typed prices unchanged when there is nothing to add', () => {
    const typed: Prices = { 'name:tin bar': coins(300) };
    expect(withMarketPrices(typed, {})).toBe(typed);
  });
});

describe('priceHintOf', () => {
  const byKey: MarketPricesByKey = {
    'name:copper bar': { copper: 113, source: 'auction' },
    'name:tin bar': { copper: 200, source: 'vendor' },
  };

  it('offers the auction price back when a typed price hides it', () => {
    expect(priceHintOf('name:copper bar', true, { 'name:copper bar': coins(90) }, byKey, true)).toEqual({
      kind: 'restore',
      copper: 113,
      source: 'auction',
    });
  });

  it('tags a vendor-filled price', () => {
    expect(priceHintOf('name:tin bar', true, {}, byKey, true)).toEqual({ kind: 'vendor' });
    // Vendor prices come with the recipe book, so they are tagged before the auction answers.
    expect(priceHintOf('name:tin bar', true, {}, byKey, false)).toEqual({ kind: 'vendor' });
  });

  it('offers the market price back, naming its source', () => {
    expect(priceHintOf('name:tin bar', true, { 'name:tin bar': coins(90) }, byKey, true)).toEqual({
      kind: 'restore',
      copper: 200,
      source: 'vendor',
    });
  });

  it('says "not listed" only when neither the auction nor a vendor has it', () => {
    expect(priceHintOf('name:mote', true, {}, byKey, true)).toEqual({ kind: 'notListed' });
    expect(priceHintOf('name:mote', true, {}, byKey, false)).toEqual({ kind: 'none' });
  });

  it('shows nothing for typed-only items or auction-priced items', () => {
    expect(priceHintOf('name:mote', false, {}, byKey, true)).toEqual({ kind: 'none' });
    expect(priceHintOf('name:copper bar', true, {}, byKey, true)).toEqual({ kind: 'none' });
  });
});

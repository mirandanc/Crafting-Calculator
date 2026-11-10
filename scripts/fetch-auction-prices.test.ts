import { describe, expect, it } from 'vitest';
import { marketValue, marketValues, unitListings, type Listing } from '@scripts/fetch-auction-prices';

const listing = (itemId: number, unitPrice: number, quantity: number): Listing => ({ itemId, unitPrice, quantity });

describe('marketValue', () => {
  it('uses the only listing when there is one', () => {
    expect(marketValue([listing(1, 120, 5)])).toBe(120);
  });

  it('averages the cheapest listings that reach 15% of the quantity, weighted by quantity', () => {
    // 100 for sale; 15% = 15. Cheapest first: 10 @ 50, then 10 @ 70 reaches 20 ≥ 15 → (500 + 700) / 20 = 60.
    const listings = [listing(1, 200, 80), listing(1, 70, 10), listing(1, 50, 10)];
    expect(marketValue(listings)).toBe(60);
  });

  it('ignores a single cheap unit when the market is deep', () => {
    // 15% of 200 = 30. The 1 @ 1c doesn't reach it, so the 199 @ 100c listing is taken whole: 19 901 / 200 → 100.
    expect(marketValue([listing(1, 1, 1), listing(1, 100, 199)])).toBe(100);
  });

  it('rounds to whole copper', () => {
    // 15% of 2 = 0.3, so only the cheapest listing is taken.
    expect(marketValue([listing(1, 10, 1), listing(1, 11, 1)])).toBe(10);
    // 15% of 20 = 3: 1 @ 10 + 3 @ 11 = 43 / 4 = 10.75 → 11.
    expect(marketValue([listing(1, 10, 1), listing(1, 11, 3), listing(1, 50, 16)])).toBe(11);
  });
});

describe('unitListings', () => {
  it('reads unit_price from commodities and buyout ÷ quantity from auctions, skipping bid-only ones', () => {
    const house = {
      auctions: [
        { id: 1, item: { id: 6266 }, buyout: 300, quantity: 1, time_left: 'LONG' },
        { id: 2, item: { id: 15310 }, buyout: 1100, quantity: 2, time_left: 'LONG' },
        { id: 3, item: { id: 999 }, bid: 50, quantity: 1, time_left: 'SHORT' },
      ],
    };
    const commodities = { auctions: [{ id: 4, item: { id: 2840 }, quantity: 20, unit_price: 113, time_left: 'MEDIUM' }] };
    expect(unitListings(house, commodities)).toEqual([
      listing(6266, 300, 1),
      listing(15310, 550, 2),
      listing(2840, 113, 20),
    ]);
  });

  it('treats a house with no auctions field (an empty house) as no listings', () => {
    expect(unitListings({}, { auctions: [] })).toEqual([]);
  });

  it('rejects an answer that is not the expected shape', () => {
    expect(() => unitListings({ auctions: 'nope' }, { auctions: [] })).toThrow('auctions');
    expect(() => unitListings({ auctions: [] }, {})).toThrow('commodities');
    expect(() => unitListings({ auctions: [{ id: 1, item: { id: 'x' }, buyout: 1, quantity: 1 }] }, { auctions: [] })).toThrow(
      'listing',
    );
  });
});

describe('marketValues', () => {
  it('groups listings by item and returns copper per item id', () => {
    expect(marketValues([listing(2840, 100, 5), listing(2589, 26, 10), listing(2840, 90, 1)])).toEqual({
      '2840': 90,
      '2589': 26,
    });
  });
});

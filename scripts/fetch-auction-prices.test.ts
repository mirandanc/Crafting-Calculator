import { describe, expect, it, vi } from 'vitest';
import {
  buildPriceList,
  checkPriceList,
  createBlizzardClient,
  marketValue,
  marketValues,
  unitListings,
  type BlizzardClientDeps,
  type Listing,
} from '@scripts/fetch-auction-prices';
import { GOLD_CAP_COPPER } from '@/money/money';
import type { AuctionHouse } from '@/prices/auctionPrices';

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

  it('a single cheap unit barely moves the value when the market is deep', () => {
    // 15% of 200 = 30. The 1 @ 1c doesn't reach it, so the 199 @ 100c listing is taken whole: 19 901 / 200 → 100.
    expect(marketValue([listing(1, 1, 1), listing(1, 100, 199)])).toBe(100);
  });

  it('stops exactly at the 15% boundary', () => {
    // 15% of 100 = 15: the cheapest listing's quantity exactly reaches it, so only it is taken.
    expect(marketValue([listing(1, 10, 15), listing(1, 100, 85)])).toBe(10);
  });

  it('throws on an empty list', () => {
    expect(() => marketValue([])).toThrow('No listings to price');
  });

  it('rounds to whole copper', () => {
    // 15% of 2 = 0.3, so only the cheapest listing is taken.
    expect(marketValue([listing(1, 10, 1), listing(1, 11, 1)])).toBe(10);
    // 15% of 20 = 3: 1 @ 10 + 3 @ 11 = 43 / 4 = 10.75 → 11.
    expect(marketValue([listing(1, 10, 1), listing(1, 11, 3), listing(1, 50, 16)])).toBe(11);
  });

  it('never rounds a listed item down to 0 copper', () => {
    // A stack of 200 bought out for 1 copper is 0.005 copper each.
    expect(marketValue([listing(1, 1 / 200, 200)])).toBe(1);
  });

  it('never goes above the gold cap the page accepts', () => {
    expect(marketValue([listing(1, GOLD_CAP_COPPER * 3, 1)])).toBe(GOLD_CAP_COPPER);
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

  it('rejects a house body that is not an object at all', () => {
    expect(() => unitListings(null, { auctions: [] })).toThrow('auctions');
  });

  it('rejects an auction with a zero buyout', () => {
    expect(() =>
      unitListings({ auctions: [{ id: 1, item: { id: 6266 }, buyout: 0, quantity: 1 }] }, { auctions: [] }),
    ).toThrow('buyout');
  });

  it('rejects a listing with a zero quantity', () => {
    expect(() =>
      unitListings({ auctions: [{ id: 1, item: { id: 6266 }, buyout: 10, quantity: 0 }] }, { auctions: [] }),
    ).toThrow('listing');
  });

  it('rejects a commodity with a non-numeric unit_price', () => {
    expect(() =>
      unitListings({ auctions: [] }, { auctions: [{ id: 1, item: { id: 2840 }, quantity: 1, unit_price: '1' }] }),
    ).toThrow('unit_price');
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

const HOUSE: AuctionHouse = { ruleset: 1, id: 110, name: 'Alliance Auction House' };

describe('buildPriceList', () => {
  it('stamps the time and house and keeps one price per item', () => {
    const list = buildPriceList([listing(2840, 113, 20)], HOUSE, new Date('2026-11-10T16:00:00Z'));
    expect(list).toEqual({
      updatedAt: '2026-11-10T16:00:00.000Z',
      house: { ruleset: 1, id: 110, name: 'Alliance Auction House' },
      prices: { '2840': 113 },
    });
  });
});

describe('checkPriceList', () => {
  it('accepts a list with enough items', () => {
    const prices = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [String(index + 1), 10]));
    expect(() => checkPriceList({ updatedAt: 'x', house: HOUSE, prices })).not.toThrow();
  });

  it('refuses a list that is suspiciously small, so it never replaces good data', () => {
    expect(() => checkPriceList({ updatedAt: 'x', house: HOUSE, prices: { '2840': 113 } })).toThrow('Only 1 items');
  });
});

describe('createBlizzardClient', () => {
  const deps = (responses: Response[]): BlizzardClientDeps => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => responses.shift() ?? new Response('', { status: 500 }));
    return { fetch };
  };

  it('gets a client-credentials token once and sends it with the Forever namespace', async () => {
    const d = deps([
      Response.json({ access_token: 'tok', expires_in: 86399 }),
      Response.json({ id: 110, name: 'Alliance Auction House' }),
      Response.json({ auctions: [] }),
    ]);
    const client = createBlizzardClient('id', 'secret', d);
    await expect(client.get('/data/wow/ruleset/1/auctions/110')).resolves.toEqual({ id: 110, name: 'Alliance Auction House' });
    await expect(client.get('/data/wow/ruleset/1/auctions/110/commodities')).resolves.toEqual({ auctions: [] });
    expect(d.fetch).toHaveBeenCalledTimes(3);
    const [tokenUrl, tokenInit] = vi.mocked(d.fetch).mock.calls[0];
    expect(tokenUrl).toBe('https://oauth.battle.net/token');
    expect(tokenInit?.method).toBe('POST');
    expect(new Headers(tokenInit?.headers).get('Authorization')).toBe(`Basic ${btoa('id:secret')}`);
    const [apiUrl, apiInit] = vi.mocked(d.fetch).mock.calls[1];
    expect(apiUrl).toBe('https://us.api.blizzard.com/data/wow/ruleset/1/auctions/110?namespace=dynamic-forever-us&locale=en_US');
    expect(new Headers(apiInit?.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('fails clearly when the token is refused', async () => {
    const client = createBlizzardClient('id', 'bad-secret', deps([new Response('', { status: 401 })]));
    const error = await client.get('/data/wow/ruleset/1/auctions/110').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('Blizzard token request failed: 401');
    expect(message).not.toContain('bad-secret');
  });

  it('fails clearly when the token answer has no access token', async () => {
    const client = createBlizzardClient('id', 'secret', deps([Response.json({ error: 'invalid_client' })]));
    await expect(client.get('/x')).rejects.toThrow('no access token');
  });

  it('fails clearly when the API answers an error', async () => {
    const d = deps([Response.json({ access_token: 'secret-token' }), new Response('', { status: 503 })]);
    const error = await createBlizzardClient('id', 'the-secret', d).get('/x').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('/x answered 503');
    expect(message).not.toContain('the-secret');
    expect(message).not.toContain('secret-token');
  });
});

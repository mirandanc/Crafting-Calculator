import { describe, expect, it, vi } from 'vitest';
import {
  bandMinimumMs,
  buildPriceList,
  checkPriceList,
  createBlizzardClient,
  detectSales,
  marketValue,
  marketValues,
  nextHistory,
  parseHistory,
  pruneEvents,
  readableHistory,
  serializeHistory,
  snapshotTime,
  summarizeSales,
  totalQuantities,
  unitListings,
  type AuctionHistory,
  type BlizzardClientDeps,
  type Listing,
  type SalesEvent,
  type SalesSummary,
  type SoldItem,
  type TimeLeftBand,
} from '@scripts/fetch-auction-prices';
import { GOLD_CAP_COPPER } from '@/money/money';
import type { AuctionHouse } from '@/prices/auctionPrices';

const listing = (itemId: number, unitPrice: number, quantity: number, id = 1, band: TimeLeftBand = 'LONG'): Listing => ({
  id,
  itemId,
  unitPrice,
  quantity,
  band,
});

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
      listing(6266, 300, 1, 1, 'LONG'),
      listing(15310, 550, 2, 2, 'LONG'),
      listing(2840, 113, 20, 4, 'MEDIUM'),
    ]);
  });

  it('reads every time-left band, and treats an unknown one as SHORT so it never counts as a sale', () => {
    const commodities = {
      auctions: ['SHORT', 'MEDIUM', 'LONG', 'VERY_LONG', 'SOON', undefined].map((time_left, index) => ({
        id: index + 1,
        item: { id: 2840 },
        quantity: 1,
        unit_price: 10,
        time_left,
      })),
    };
    expect(unitListings({}, commodities).map((entry) => entry.band)).toEqual(['SHORT', 'MEDIUM', 'LONG', 'VERY_LONG', 'SHORT', 'SHORT']);
  });

  it('rejects a listing without an id', () => {
    expect(() => unitListings({}, { auctions: [{ item: { id: 2840 }, quantity: 1, unit_price: 10 }] })).toThrow('listing');
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

describe('bandMinimumMs', () => {
  it('gives the least time a listing in each band has left', () => {
    expect(bandMinimumMs('SHORT')).toBe(0);
    expect(bandMinimumMs('MEDIUM')).toBe(30 * 60_000);
    expect(bandMinimumMs('LONG')).toBe(2 * 3_600_000);
    // Blizzard documents 12 h; 8 h is the safer floor.
    expect(bandMinimumMs('VERY_LONG')).toBe(8 * 3_600_000);
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

describe('totalQuantities', () => {
  it('sums the quantity for sale per item id', () => {
    const listings = [listing(1, 50, 10), listing(2, 70, 3), listing(1, 90, 5)];
    expect(totalQuantities(listings)).toEqual({ '1': 15, '2': 3 });
  });
});

const HOUSE: AuctionHouse = { ruleset: 1, id: 110, name: 'Alliance Auction House' };

describe('buildPriceList', () => {
  it('stamps the time and house and keeps one price per item', () => {
    const list = buildPriceList([listing(2840, 113, 20)], HOUSE, new Date('2026-11-10T16:00:00Z'), null);
    expect(list).toEqual({
      updatedAt: '2026-11-10T16:00:00.000Z',
      house: { ruleset: 1, id: 110, name: 'Alliance Auction House' },
      prices: { '2840': 113 },
      quantities: { '2840': 20 },
    });
  });

  it('adds the estimated sales once there are some', () => {
    const sales: SalesSummary = { sales: { '2840': { perDay: 64, price: 114 } }, salesDays: 0.28125 };
    const list = buildPriceList([listing(2840, 113, 20)], HOUSE, new Date('2026-11-10T16:00:00Z'), sales);
    expect(list).toMatchObject({ sales: { '2840': { perDay: 64, price: 114 } }, salesDays: 0.28125 });
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

  it('gives the Last-Modified time of an answer with its body', async () => {
    const d = deps([
      Response.json({ access_token: 'tok' }),
      Response.json({ auctions: [] }, { headers: { 'Last-Modified': 'Wed, 11 Nov 2026 16:22:37 GMT' } }),
      Response.json({ auctions: [] }),
      Response.json({ auctions: [] }, { headers: { 'Last-Modified': 'not a date' } }),
    ]);
    const client = createBlizzardClient('id', 'secret', d);
    await expect(client.getAnswer('/a')).resolves.toEqual({ body: { auctions: [] }, lastModified: new Date('2026-11-11T16:22:37.000Z') });
    await expect(client.getAnswer('/b')).resolves.toEqual({ body: { auctions: [] }, lastModified: null });
    await expect(client.getAnswer('/c')).resolves.toEqual({ body: { auctions: [] }, lastModified: null });
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

const MINUTES = 60_000;

describe('detectSales', () => {
  it('counts vanished and shrunk listings whose band outlasts the gap, at their unit price', () => {
    const previous = [
      listing(10, 100, 5, 1, 'LONG'), // gone; LONG (2 h) outlasts 1h30 → 5 sold for 500
      listing(10, 120, 20, 2, 'VERY_LONG'), // shrank to 12 → 8 sold for 960
      listing(20, 50, 3, 3, 'MEDIUM'), // gone, but MEDIUM (30 min) may simply have expired
      listing(20, 70, 2, 4, 'VERY_LONG'), // unchanged
      listing(40, 550.5, 2, 6, 'LONG'), // a house auction bought whole: 1101
    ];
    const current = [
      listing(10, 120, 12, 2, 'VERY_LONG'),
      listing(20, 70, 2, 4, 'VERY_LONG'),
      listing(30, 10, 9, 5, 'SHORT'), // new: nothing sold
    ];
    expect(detectSales(previous, current, 90 * MINUTES)).toEqual({ '10': [13, 1460], '40': [2, 1101] });
  });

  it('needs the band minimum to exceed the gap, not just reach it', () => {
    expect(detectSales([listing(10, 100, 5, 1, 'LONG')], [], 120 * MINUTES)).toEqual({});
  });

  it('treats an id now used by another item as gone', () => {
    expect(detectSales([listing(10, 100, 5, 1, 'LONG')], [listing(11, 100, 5, 1, 'LONG')], 90 * MINUTES)).toEqual({ '10': [5, 500] });
  });

  it('ignores a listing that grew', () => {
    expect(detectSales([listing(10, 100, 5, 1, 'LONG')], [listing(10, 100, 7, 1, 'LONG')], 90 * MINUTES)).toEqual({});
  });

  it('finds no sales when the snapshots are not apart in time', () => {
    const previous = [listing(10, 100, 5, 1, 'LONG')];
    expect(detectSales(previous, [], 0)).toEqual({});
    expect(detectSales(previous, [], -30 * MINUTES)).toEqual({});
  });

  it('rounds the copper per item', () => {
    // 2 × 33.4 + 1 × 33.4 = 100.2 → 100.
    const previous = [listing(10, 33.4, 2, 1, 'LONG'), listing(10, 33.4, 1, 2, 'LONG')];
    expect(detectSales(previous, [], 90 * MINUTES)).toEqual({ '10': [3, 100] });
  });
});

const HOURS = 60 * MINUTES;
const NOW = new Date('2026-11-11T12:00:00.000Z');

const event = (at: string, gapMs: number, sold: Record<string, SoldItem> = {}): SalesEvent => ({ at, gapMs, sold });

describe('pruneEvents', () => {
  it('keeps events whose whole span lies within the last 7 days', () => {
    const tooOld = event('2026-11-04T13:00:00.000Z', 1.5 * HOURS); // starts 11:30, before the window opens at 12:00
    const edge = event('2026-11-04T13:30:00.000Z', 1.5 * HOURS); // starts exactly at 12:00
    const recent = event('2026-11-11T10:30:00.000Z', 5.25 * HOURS);
    expect(pruneEvents([tooOld, edge, recent], NOW)).toEqual([edge, recent]);
  });
});

describe('nextHistory', () => {
  const current = [listing(10, 120, 12, 2, 'VERY_LONG')];

  it('starts a history with no events when there was none', () => {
    expect(nextHistory(null, current, NOW)).toEqual({ at: '2026-11-11T12:00:00.000Z', listings: current, events: [] });
  });

  it('adds an event for the gap since the previous snapshot and drops events older than 7 days', () => {
    const old = event('2026-11-01T12:00:00.000Z', 5.25 * HOURS, { '10': [1, 100] });
    const kept = event('2026-11-11T10:30:00.000Z', 5.25 * HOURS, { '20': [2, 100] });
    const previous: AuctionHistory = {
      at: '2026-11-11T10:30:00.000Z',
      listings: [listing(10, 100, 5, 1, 'LONG'), listing(10, 120, 20, 2, 'VERY_LONG')],
      events: [old, kept],
    };
    expect(nextHistory(previous, current, NOW)).toEqual({
      at: '2026-11-11T12:00:00.000Z',
      listings: current,
      events: [kept, event('2026-11-11T12:00:00.000Z', 1.5 * HOURS, { '10': [13, 1460] })],
    });
  });

  it('records no event but takes the new snapshot when no band could outlast the gap', () => {
    const kept = event('2026-11-11T02:00:00.000Z', 5.25 * HOURS);
    const previous: AuctionHistory = { at: '2026-11-11T04:00:00.000Z', listings: [listing(10, 100, 5, 1, 'LONG')], events: [kept] };
    // 8 h: even VERY_LONG may have expired.
    expect(nextHistory(previous, current, NOW)).toEqual({ at: '2026-11-11T12:00:00.000Z', listings: current, events: [kept] });
  });

  it('keeps the previous snapshot when the new one is not newer, only pruning its events', () => {
    const old = event('2026-11-01T12:00:00.000Z', 5.25 * HOURS);
    const kept = event('2026-11-11T02:00:00.000Z', 5.25 * HOURS);
    const previousListings = [listing(10, 100, 5, 1, 'LONG')];
    // The same answer again, then an older one (a stale answer or clock skew).
    for (const previousAt of ['2026-11-11T12:00:00.000Z', '2026-11-11T13:00:00.000Z']) {
      const previous: AuctionHistory = { at: previousAt, listings: previousListings, events: [old, kept] };
      expect(nextHistory(previous, current, NOW)).toEqual({ at: previousAt, listings: previousListings, events: [kept] });
    }
  });
});

describe('readableHistory', () => {
  const stored = (at: string) => serializeHistory({ at, listings: [listing(10, 100, 5, 1, 'LONG')], events: [] });

  it('reads a history dated up to 1 hour after the run time', () => {
    expect(readableHistory(stored('2026-11-11T13:00:00.000Z'), NOW)?.at).toBe('2026-11-11T13:00:00.000Z');
  });

  it('treats a history dated more than 1 hour after the run time as unreadable, so it cannot freeze', () => {
    expect(readableHistory(stored('2026-11-11T13:00:00.001Z'), NOW)).toBeNull();
  });

  it('gives no history for corrupt input', () => {
    expect(readableHistory('{', NOW)).toBeNull();
  });
});

describe('summarizeSales', () => {
  it('gives no sales before the first comparison', () => {
    expect(summarizeSales([])).toBeNull();
  });

  it('divides what sold by the days covered and averages the price paid', () => {
    // Covered: 1.5 h + 5.25 h = 6.75 h = 0.28125 days.
    // Item 10: 18 sold → 18 ÷ 0.28125 = 64 a day; 2060c ÷ 18 = 114.4 → 114c.
    // Item 20: 2 sold → 7.11 a day; 50c.
    const events = [
      event('2026-11-11T10:30:00.000Z', 1.5 * HOURS, { '10': [13, 1460] }),
      event('2026-11-11T15:45:00.000Z', 5.25 * HOURS, { '10': [5, 600], '20': [2, 100] }),
    ];
    expect(summarizeSales(events)).toEqual({
      sales: { '10': { perDay: 64, price: 114 }, '20': { perDay: 7.11, price: 50 } },
      salesDays: 0.28125,
    });
  });

  it('keeps a comparison that found no sales as covered time', () => {
    expect(summarizeSales([event('2026-11-11T10:30:00.000Z', 6 * HOURS)])).toEqual({ sales: {}, salesDays: 0.25 });
  });

  it('covers at most 7 days', () => {
    const events = [event('2026-11-07T12:00:00.000Z', 96 * HOURS, { '10': [40, 4000] }), event('2026-11-11T12:00:00.000Z', 96 * HOURS, { '10': [30, 3000] })];
    expect(summarizeSales(events)).toEqual({ sales: { '10': { perDay: 10, price: 100 } }, salesDays: 7 });
  });

  it('never prices a sale below 1 copper', () => {
    expect(summarizeSales([event('2026-11-11T12:00:00.000Z', 24 * HOURS, { '10': [200, 0] })])?.sales).toEqual({ '10': { perDay: 200, price: 1 } });
  });
});

describe('snapshotTime', () => {
  const runTime = new Date('2026-11-11T17:02:33.000Z');
  const house = new Date('2026-11-11T16:22:37.000Z');
  const commodities = new Date('2026-11-11T16:40:00.000Z');

  it("uses the older of the answers' Last-Modified times", () => {
    expect(snapshotTime([house, commodities], runTime)).toEqual(house);
    expect(snapshotTime([commodities, house], runTime)).toEqual(house);
  });

  it('falls back to the run time when an answer has no Last-Modified time', () => {
    expect(snapshotTime([house, null], runTime)).toEqual(runTime);
    expect(snapshotTime([null, commodities], runTime)).toEqual(runTime);
  });
});

describe('serializeHistory and parseHistory', () => {
  const history: AuctionHistory = {
    at: '2026-11-11T12:00:00.000Z',
    listings: [listing(10, 120, 12, 2, 'VERY_LONG'), listing(20, 50, 3, 3, 'SHORT')],
    events: [event('2026-11-11T12:00:00.000Z', 1.5 * HOURS, { '10': [13, 1460] })],
  };

  it('round-trips a history, storing each listing as a compact array', () => {
    const text = serializeHistory(history);
    expect(JSON.parse(text)).toMatchObject({ listings: [[2, 10, 120, 12, 3], [3, 20, 50, 3, 0]] });
    expect(parseHistory(text)).toEqual(history);
  });

  it('stores unit prices as whole copper', () => {
    const fractional: AuctionHistory = { ...history, listings: [listing(40, 550.5, 2, 6, 'LONG')] };
    expect(parseHistory(serializeHistory(fractional))?.listings).toEqual([listing(40, 551, 2, 6, 'LONG')]);
  });

  it('gives no history for missing or corrupt input', () => {
    for (const text of ['', 'Value not found', '{', 'null', '[]', '{"at":"x","listings":[]}', '{"at":"2026-11-11T12:00:00.000Z"}']) {
      expect(parseHistory(text)).toBeNull();
    }
  });

  it('drops bad listings, events and sold entries one by one', () => {
    const text = JSON.stringify({
      at: '2026-11-11T12:00:00.000Z',
      listings: [[2, 10, 120, 12, 3], [0, 10, 1, 1, 1], [3, 10, 1, 1, 9], [4, 10, -1, 1, 1], [5, 10, 1, 1.5, 1], 'x'],
      events: [
        { at: '2026-11-11T12:00:00.000Z', gapMs: 5_400_000, sold: { '10': [13, 1460], '11': [0, 5], '12': [1, -1], x: [1, 1] } },
        { at: 'x', gapMs: 5_400_000, sold: {} },
        { at: '2026-11-11T12:00:00.000Z', gapMs: -1, sold: {} },
        { at: '2026-11-11T12:00:00.000Z', gapMs: 5_400_000 },
      ],
    });
    expect(parseHistory(text)).toEqual({
      at: '2026-11-11T12:00:00.000Z',
      listings: [listing(10, 120, 12, 2, 'VERY_LONG')],
      events: [event('2026-11-11T12:00:00.000Z', 5_400_000, { '10': [13, 1460] })],
    });
  });

  it('reads a history without events as one that has none yet', () => {
    expect(parseHistory('{"at":"2026-11-11T12:00:00.000Z","listings":[]}')).toEqual({ at: '2026-11-11T12:00:00.000Z', listings: [], events: [] });
  });
});

import { describe, expect, it } from 'vitest';
import { GOLD_CAP_COPPER } from '@/money/money';
import { auctionStatusOf, parseAuctionPriceList, type AuctionPriceList } from '@/prices/auctionPrices';

const LIST: AuctionPriceList = {
  updatedAt: '2026-11-10T16:00:00.000Z',
  house: { ruleset: 1, id: 110, name: 'Alliance Auction House' },
  prices: { '2840': 113, '3576': 250 },
};

describe('parseAuctionPriceList', () => {
  it('accepts a valid list and drops malformed prices', () => {
    expect(parseAuctionPriceList({ ...LIST, prices: { ...LIST.prices, '9': -1, x: 'y' } })).toEqual(LIST);
  });

  it('rejects anything without a time or prices', () => {
    expect(parseAuctionPriceList(null)).toBeNull();
    expect(parseAuctionPriceList({ ...LIST, updatedAt: 'not a date' })).toBeNull();
    expect(parseAuctionPriceList({ ...LIST, prices: [] })).toBeNull();
  });

  it('drops prototype keys, fractions, zero, non-finite and over-cap prices', () => {
    const prices: unknown = JSON.parse('{"2840": 113, "3576": 250, "__proto__": 5}');
    const extra: Record<string, number> = { '1': 1.5, '2': 0, '3': Infinity, '4': GOLD_CAP_COPPER + 1, '5': GOLD_CAP_COPPER };
    const parsed = parseAuctionPriceList({ ...LIST, prices: Object.assign(prices as object, extra) });
    expect(parsed).toEqual({ ...LIST, prices: { ...LIST.prices, '5': GOLD_CAP_COPPER } });
    expect(Object.keys(parsed?.prices ?? {})).not.toContain('__proto__');
  });

  it('rejects a missing or malformed house', () => {
    expect(parseAuctionPriceList({ updatedAt: LIST.updatedAt, prices: LIST.prices })).toBeNull();
    expect(parseAuctionPriceList({ ...LIST, house: { ...LIST.house, id: '110' } })).toBeNull();
    expect(parseAuctionPriceList({ ...LIST, house: { ...LIST.house, id: 110.5 } })).toBeNull();
    expect(parseAuctionPriceList({ ...LIST, house: { ...LIST.house, ruleset: 1.5 } })).toBeNull();
  });

  it('keeps the quantities for sale when the list has them, dropping bad ones', () => {
    const parsed = parseAuctionPriceList({ ...LIST, quantities: { '2840': 40, '3576': 0, x: 3, '9': 2.5 } });
    expect(parsed?.quantities).toEqual({ '2840': 40 });
  });

  it('leaves quantities out for a list saved before they existed', () => {
    expect(parseAuctionPriceList(LIST)).not.toHaveProperty('quantities');
  });
});

describe('auctionStatusOf', () => {
  const now = Date.parse('2026-11-10T21:00:00.000Z');

  it('says nothing while loading', () => {
    expect(auctionStatusOf({ list: null, failed: false }, now)).toBeNull();
  });

  it('says when prices are unavailable', () => {
    expect(auctionStatusOf({ list: null, failed: true }, now)).toEqual({ text: 'Auction prices unavailable', stale: true });
  });

  it('gives the age in minutes, hours, then days', () => {
    const at = (updatedAt: string) => auctionStatusOf({ list: { ...LIST, updatedAt }, failed: false }, now);
    expect(at('2026-11-10T20:20:00.000Z')).toEqual({ text: 'Auction prices updated 40 min ago · US Alliance', stale: false });
    expect(at('2026-11-10T16:00:00.000Z')).toEqual({ text: 'Auction prices updated 5 h ago · US Alliance', stale: false });
    expect(at('2026-11-09T20:00:00.000Z')).toEqual({ text: 'Auction prices updated 25 h ago · US Alliance', stale: false });
    expect(at('2026-11-07T20:00:00.000Z')).toEqual({ text: 'Auction prices are 3 days old · US Alliance', stale: true });
  });

  it('treats a future time as just updated', () => {
    expect(auctionStatusOf({ list: { ...LIST, updatedAt: '2026-11-10T22:00:00.000Z' }, failed: false }, now)).toEqual({
      text: 'Auction prices updated 1 min ago · US Alliance',
      stale: false,
    });
  });

  it('turns stale at exactly 48 hours', () => {
    const at = (updatedAt: string) => auctionStatusOf({ list: { ...LIST, updatedAt }, failed: false }, now);
    expect(at('2026-11-08T21:01:00.000Z')).toEqual({ text: 'Auction prices updated 47 h ago · US Alliance', stale: false });
    expect(at('2026-11-08T21:00:00.000Z')).toEqual({ text: 'Auction prices are 2 days old · US Alliance', stale: true });
  });
});

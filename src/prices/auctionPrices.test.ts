import { describe, expect, it } from 'vitest';
import {
  auctionHintOf,
  auctionPricesByKey,
  auctionStatusOf,
  parseAuctionPriceList,
  withAuctionPrices,
  type AuctionPriceList,
} from '@/prices/auctionPrices';
import { createRecipeBlock, type Prices } from '@/sheet/sheet';
import { coins, itemRow, recipeBlock } from '@/test/sheetFixtures';

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
});

describe('auctionPricesByKey', () => {
  it('maps each linked entry name to its auction price', () => {
    const entries = [recipeBlock('a', 'Smelt Bronze', 2), itemRow('i', 'Linen Cloth', 1, 2589), itemRow('t', 'typed', 1)];
    expect(auctionPricesByKey(entries, LIST.prices)).toEqual({ 'name:copper bar': 113, 'name:tin bar': 250 });
  });

  it('is empty without entries or without a list', () => {
    expect(auctionPricesByKey([createRecipeBlock()], LIST.prices)).toEqual({});
    expect(auctionPricesByKey([recipeBlock('a', 'Smelt Bronze', 2)], {})).toEqual({});
  });
});

describe('withAuctionPrices', () => {
  it('fills unpriced names from the auction and lets typed prices win', () => {
    const typed: Prices = { 'name:tin bar': coins(300) };
    expect(withAuctionPrices(typed, { 'name:copper bar': 113, 'name:tin bar': 250 })).toEqual({
      'name:copper bar': coins(113),
      'name:tin bar': coins(300),
    });
  });

  it('returns the typed prices unchanged when there is nothing to add', () => {
    const typed: Prices = { 'name:tin bar': coins(300) };
    expect(withAuctionPrices(typed, {})).toBe(typed);
  });
});

describe('auctionHintOf', () => {
  const byKey = { 'name:copper bar': 113 };

  it('offers the auction price back when a typed price hides it', () => {
    expect(auctionHintOf('name:copper bar', true, { 'name:copper bar': coins(90) }, byKey, true)).toEqual({ kind: 'restore', copper: 113 });
  });

  it('tags a linked item that has no auction price and no typed price', () => {
    expect(auctionHintOf('name:tin bar', true, {}, byKey, true)).toEqual({ kind: 'notListed' });
  });

  it('shows nothing for typed-only items, auction-priced items, or before the list has loaded', () => {
    expect(auctionHintOf('name:tin bar', false, {}, byKey, true)).toEqual({ kind: 'none' });
    expect(auctionHintOf('name:copper bar', true, {}, byKey, true)).toEqual({ kind: 'none' });
    expect(auctionHintOf('name:tin bar', true, {}, byKey, false)).toEqual({ kind: 'none' });
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
});

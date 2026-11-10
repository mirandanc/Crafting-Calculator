import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuctionPrices } from '@/prices/useAuctionPrices';
import type { AuctionPriceList } from '@/prices/auctionPrices';

const LIST: AuctionPriceList = {
  updatedAt: '2026-11-10T16:00:00.000Z',
  house: { ruleset: 1, id: 110, name: 'Alliance Auction House' },
  prices: { '2840': 113 },
};

describe('useAuctionPrices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads the price list once', async () => {
    const fetchMock = vi.fn(async () => Response.json(LIST));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAuctionPrices());
    expect(result.current).toEqual({ list: null, failed: false });
    await waitFor(() => expect(result.current.list).toEqual(LIST));
    expect(fetchMock).toHaveBeenCalledWith('/api/auction-prices');
  });

  it('reports a failure for an error answer or an invalid body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    const failed = renderHook(() => useAuctionPrices());
    await waitFor(() => expect(failed.result.current).toEqual({ list: null, failed: true }));

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ nope: true })));
    const invalid = renderHook(() => useAuctionPrices());
    await waitFor(() => expect(invalid.result.current).toEqual({ list: null, failed: true }));
  });
});

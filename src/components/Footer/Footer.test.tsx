import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Footer } from '@/components/Footer/Footer';
import type { AuctionPriceList, AuctionPricesState } from '@/prices/auctionPrices';

const LIST: AuctionPriceList = {
  updatedAt: '2026-11-10T17:00:00Z',
  house: { ruleset: 1, id: 110, name: 'Alliance Auction House' },
  prices: { '2840': 100 },
};
const LOADING: AuctionPricesState = { list: null, failed: false };
const LOADED: AuctionPricesState = { list: LIST, failed: false };
const FAILED: AuctionPricesState = { list: null, failed: true };

describe('Footer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('credits ForeverDB with a link to its site', () => {
    render(<Footer auction={LOADING} />);
    expect(screen.getByRole('link', { name: 'Data by ForeverDB.net' })).toHaveAttribute('href', 'https://foreverdb.net');
  });

  it('shows the auction status above the credit, in the warning style when stale', () => {
    vi.setSystemTime(new Date('2026-11-10T22:00:00Z'));
    const { unmount } = render(<Footer auction={LOADED} />);
    expect(screen.getByText('Auction prices updated 5 h ago · US Alliance')).not.toHaveAttribute('data-stale');
    unmount();
    vi.setSystemTime(new Date('2026-11-13T17:00:00Z'));
    render(<Footer auction={LOADED} />);
    expect(screen.getByText('Auction prices are 3 days old · US Alliance')).toHaveAttribute('data-stale', 'true');
  });

  it('turns the status stale on its own once a minute passes', () => {
    // 30 s short of two days old.
    vi.setSystemTime(new Date('2026-11-12T16:59:30Z'));
    render(<Footer auction={LOADED} />);
    expect(screen.getByText('Auction prices updated 47 h ago · US Alliance')).not.toHaveAttribute('data-stale');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Auction prices are 2 days old · US Alliance')).toHaveAttribute('data-stale', 'true');
  });

  it('says the auction prices are unavailable when they fail to load', () => {
    render(<Footer auction={FAILED} />);
    expect(screen.getByRole('status')).toHaveTextContent('Auction prices unavailable');
  });

  it('keeps an empty status line while auction prices load', () => {
    render(<Footer auction={LOADING} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

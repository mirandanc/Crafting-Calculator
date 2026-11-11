import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarketAnalysis, type MarketAnalysisProps } from '@/components/MarketAnalysis/MarketAnalysis';
import type { AuctionPriceList } from '@/prices/auctionPrices';
import type { CatalogRecipe, RecipeCatalog } from '@/recipes/catalog';
import { TEST_CATALOG } from '@/test/catalogFixture';

const LIST: AuctionPriceList = {
  updatedAt: '2026-11-10T16:00:00.000Z',
  house: { ruleset: 1, id: 110, name: 'Alliance Auction House' },
  prices: { '2840': 113, '3576': 250, '2841': 900, '10421': 2000, '4371': 5000 },
  quantities: { '2841': 10, '10421': 10, '4371': 10 },
};

/** 30 profitable copies of Rough Copper Vest, so the list needs "Show more". */
const MANY: RecipeCatalog = {
  ...TEST_CATALOG,
  recipes: Array.from({ length: 30 }, (_, index): CatalogRecipe => ({ ...TEST_CATALOG.recipes[1], id: index + 1, name: `Vest ${String(index + 1).padStart(2, '0')}` })),
};

const renderAnalysis = (overrides: Partial<MarketAnalysisProps> = {}) => {
  const props: MarketAnalysisProps = {
    catalog: TEST_CATALOG,
    catalogFailed: false,
    auction: { list: LIST, failed: false },
    professions: [],
    minProfit: { gold: 0, silver: 0, copper: 50 },
    onMinProfitChange: vi.fn(),
    onMinProfitBlur: vi.fn(),
    onAdd: vi.fn(),
    ...overrides,
  };
  render(<MarketAnalysis {...props} />);
  return props;
};

const cardNames = () => screen.queryAllByRole('button', { name: /^Add / }).map((card) => card.getAttribute('aria-label'));

describe('MarketAnalysis', () => {
  it('ranks the recipes, best margin first', () => {
    renderAnalysis();
    expect(cardNames()).toEqual([
      'Add Smelt Bronze to the market list',
      'Add Rough Copper Vest to the market list',
      'Add Bronze Tube to the market list',
    ]);
  });

  it('applies the minimum profit', () => {
    renderAnalysis({ minProfit: { gold: 0, silver: 20, copper: 0 } });
    expect(cardNames()).toEqual(['Add Bronze Tube to the market list']);
  });

  it('applies the professions', () => {
    renderAnalysis({ professions: ['Blacksmithing'] });
    expect(cardNames()).toEqual(['Add Rough Copper Vest to the market list']);
  });

  it('shows 25, then 25 more', async () => {
    renderAnalysis({ catalog: MANY });
    expect(cardNames()).toHaveLength(25);
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(cardNames()).toHaveLength(30);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('passes the minimum profit edits up', async () => {
    const props = renderAnalysis();
    await userEvent.type(screen.getByLabelText('Minimum profit silver'), '2');
    expect(props.onMinProfitChange).toHaveBeenLastCalledWith({ gold: 0, silver: 2, copper: 50 });
  });

  it('explains an empty ranking', () => {
    renderAnalysis({ minProfit: { gold: 100, silver: 0, copper: 0 } });
    expect(screen.getByText('No recipe makes at least 100g per craft right now.')).toBeInTheDocument();
  });

  it('says why it cannot rank', () => {
    renderAnalysis({ auction: { list: null, failed: true } });
    expect(screen.getByText("Auction prices are unavailable, so recipes can't be ranked right now.")).toBeInTheDocument();
  });

  it('says when the recipe book failed', () => {
    renderAnalysis({ catalog: null, catalogFailed: true });
    expect(screen.getByText("The recipe book could not be opened, so recipes can't be ranked.")).toBeInTheDocument();
  });

  it('waits quietly while the recipe book or the prices load', () => {
    renderAnalysis({ catalog: null });
    expect(screen.getByText('Weighing the market…')).toBeInTheDocument();
    expect(cardNames()).toEqual([]);
  });

  it('waits while the auction prices load', () => {
    renderAnalysis({ auction: { list: null, failed: false } });
    expect(screen.getByText('Weighing the market…')).toBeInTheDocument();
  });
});

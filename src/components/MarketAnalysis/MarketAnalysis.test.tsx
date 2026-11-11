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

/** Same prices as LIST, with sales: by profit per day Vest 19460, Tube 14750, Smelt 8082 (see ranking.test.ts). */
const SOLD: AuctionPriceList = {
  ...LIST,
  sales: { '2841': { perDay: 6, price: 1000 }, '10421': { perDay: 20, price: 1500 }, '4371': { perDay: 5, price: 5000 } },
  salesDays: 3.4,
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
    sort: 'profitPerDay',
    onSortChange: vi.fn(),
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

  it('ranks by profit per day once sales are known, and says how many days they cover', () => {
    renderAnalysis({ auction: { list: SOLD, failed: false } });
    expect(cardNames()).toEqual([
      'Add Rough Copper Vest to the market list',
      'Add Bronze Tube to the market list',
      'Add Smelt Bronze to the market list',
    ]);
    expect(screen.getByText('Sales from the last 3 days')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Profit per day' })).toBeChecked();
  });

  it('ranks by margin when that sort is picked', () => {
    renderAnalysis({ auction: { list: SOLD, failed: false }, sort: 'margin' });
    expect(cardNames()).toEqual([
      'Add Smelt Bronze to the market list',
      'Add Rough Copper Vest to the market list',
      'Add Bronze Tube to the market list',
    ]);
    expect(screen.getByRole('radio', { name: 'Margin' })).toBeChecked();
  });

  it('passes the sort choice up from a radio group', async () => {
    const props = renderAnalysis();
    expect(screen.getByRole('radiogroup', { name: 'Sort by' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Margin' }));
    expect(props.onSortChange).toHaveBeenCalledWith('margin');
  });

  it('says sales are still being counted while the list has none', () => {
    renderAnalysis();
    expect(screen.getByText('Sales are still being counted; ranking by margin only.')).toBeInTheDocument();
  });

  it('says "< 1 day" before the first full day, even when nothing qualifies', () => {
    renderAnalysis({ auction: { list: { ...SOLD, salesDays: 0.25 }, failed: false }, minProfit: { gold: 100, silver: 0, copper: 0 } });
    expect(screen.getByText('Sales from the last < 1 day')).toBeInTheDocument();
    expect(screen.getByText('No recipe makes at least 100g per craft right now.')).toBeInTheDocument();
  });
});

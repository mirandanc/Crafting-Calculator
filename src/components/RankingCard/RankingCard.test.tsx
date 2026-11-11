import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RankingCard } from '@/components/RankingCard/RankingCard';
import type { RankedRecipe } from '@/market/ranking';
import { testRecipe } from '@/test/catalogFixture';

const SMELT: RankedRecipe = {
  recipe: testRecipe('Smelt Bronze'),
  reagents: [
    { itemId: 2840, name: 'Copper Bar', icon: null, count: 1, unitPrice: 113, source: 'auction' },
    { itemId: 3576, name: 'Tin Bar', icon: null, count: 1, unitPrice: 200, source: 'vendor' },
  ],
  revenue: 1710,
  cost: 313,
  profit: 1397,
  margin: 1397 / 313,
  salesPerDay: null,
  profitPerDay: null,
};

describe('RankingCard', () => {
  it('shows the margin, money and reagents', () => {
    render(<RankingCard ranked={SMELT} onAdd={vi.fn()} />);
    const card = screen.getByRole('button', { name: /Add Smelt Bronze to the market list/ });
    expect(within(card).getByText('446%')).toBeInTheDocument();
    expect(card).toHaveAccessibleDescription(
      'Mining, 446% margin. Profit 13s 97c Sells for 17s 10c Costs 3s 13c Copper Bar ×1 1s 13c Tin Bar ×1 2s Vendor',
    );
    expect(within(card).getByText('Mining')).toBeInTheDocument();
    expect(within(card).getByText('13s 97c')).toBeInTheDocument(); // profit (sr-only text)
    expect(within(card).getByText('17s 10c')).toBeInTheDocument(); // sells for
    expect(within(card).getByText('3s 13c')).toBeInTheDocument(); // costs
    const tin = within(card).getByRole('listitem', { name: 'Tin Bar' });
    expect(within(tin).getByText('Vendor')).toBeInTheDocument();
    expect(within(tin).getByText('2s')).toBeInTheDocument();
    expect(within(within(card).getByRole('listitem', { name: 'Copper Bar' })).queryByText('Vendor')).toBeNull();
  });

  it('adds the recipe when clicked', async () => {
    const onAdd = vi.fn();
    render(<RankingCard ranked={SMELT} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: /Add Smelt Bronze/ }));
    expect(onAdd).toHaveBeenCalledWith(SMELT.recipe);
  });

  it('shows the estimated sales and profit per day when sales are known', () => {
    render(<RankingCard ranked={{ ...SMELT, salesPerDay: 14, profitPerDay: 42_000 }} onAdd={vi.fn()} />);
    const card = screen.getByRole('button', { name: /Add Smelt Bronze to the market list/ });
    expect(card).toHaveAccessibleDescription(
      'Mining, 446% margin. Profit 13s 97c Sells for 17s 10c Costs 3s 13c ~14 sold/day · ≈ 4g 20s/day Copper Bar ×1 1s 13c Tin Bar ×1 2s Vendor',
    );
  });

  it('rounds sales per day down to a whole number', () => {
    render(<RankingCard ranked={{ ...SMELT, salesPerDay: 6.43, profitPerDay: 8_982 }} onAdd={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add Smelt Bronze/ })).toHaveAccessibleDescription(/~6 sold\/day · ≈ 89s 82c\/day/);
  });

  it('leaves the sales line out while sales are unknown', () => {
    render(<RankingCard ranked={SMELT} onAdd={vi.fn()} />);
    expect(screen.queryByText(/sold\/day/)).toBeNull();
  });
});

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShoppingList } from '@/components/ShoppingList/ShoppingList';
import { createRecipeBlock } from '@/sheet/sheet';
import { summarizeShopping, type ShoppingSummary } from '@/sheet/shopping';
import { coins, recipeBlock } from '@/test/sheetFixtures';

const renderList = () => {
  const summary = summarizeShopping(
    [recipeBlock('a', 'Smelt Bronze', 2), recipeBlock('b', 'Rough Copper Vest', 1)],
    { 'name:copper bar': coins(10) },
  );
  render(<ShoppingList summary={summary} />);
  return screen.getByRole('region', { name: 'Shopping list' });
};

describe('ShoppingList', () => {
  it('lists each item once with its summed quantity, icon and source recipes', () => {
    const list = renderList();
    expect(within(list).getByRole('heading', { name: 'Shopping list' })).toBeInTheDocument();
    const [copper] = within(list).getAllByRole('listitem');
    expect(within(copper).getByText('Copper Bar')).toBeInTheDocument();
    expect(within(copper).getByText('Smelt Bronze, Rough Copper Vest')).toBeInTheDocument();
    expect(within(copper).getByText('5 ×')).toBeInTheDocument();
    expect(within(copper).getByText('= 50c')).toBeInTheDocument();
    expect(copper.querySelector('img')).toHaveAttribute('src', 'https://foreverdb.net/icons/133216.webp');
  });

  it('keeps unpriced lines, leaves them out of the total, and counts them', () => {
    const list = renderList();
    const [, tin] = within(list).getAllByRole('listitem');
    expect(within(tin).getByText('unpriced')).toBeInTheDocument();
    expect(within(list).getByText('Total cost')).toBeInTheDocument();
    expect(within(list).getByText('50c')).toHaveClass('sr-only');
    expect(within(list).getByText('1 item unpriced')).toBeInTheDocument();
  });

  it('shows a placeholder when there is nothing to buy', () => {
    render(<ShoppingList summary={summarizeShopping([createRecipeBlock()], {})} />);
    expect(screen.getByText('Nothing to buy yet.')).toBeInTheDocument();
    expect(screen.queryByText('Total cost')).toBeNull();
    expect(screen.queryByText(/unpriced/)).toBeNull();
  });

  it('puts aria-live on the total alone, so the announcement is never a bare number', () => {
    const list = renderList();
    const liveRegion = list.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toHaveTextContent('Total cost');
    expect(liveRegion).toHaveTextContent('50c');
    // The unpriced note sits outside the live-total region.
    expect(liveRegion).not.toHaveTextContent('unpriced');
  });

  it('shows the plural unpriced count and hides the large total when every line is unpriced', () => {
    const summary: ShoppingSummary = {
      lines: [
        { key: 'name:copper bar', name: 'Copper Bar', icon: null, itemId: null, quantity: 5, unitPrice: 0, sources: [] },
        { key: 'name:tin bar', name: 'Tin Bar', icon: null, itemId: null, quantity: 3, unitPrice: 0, sources: [] },
      ],
      total: 0,
      unpricedCount: 2,
    };
    render(<ShoppingList summary={summary} />);
    const list = screen.getByRole('region', { name: 'Shopping list' });
    expect(within(list).getByText('2 items unpriced')).toBeInTheDocument();
    const liveRegion = list.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeEmptyDOMElement();
  });

  it('shows unpriced lines with just the quantity, no multiplication sign', () => {
    const list = renderList();
    const [, tin] = within(list).getAllByRole('listitem');
    expect(within(tin).getByText('1')).toBeInTheDocument();
    expect(within(tin).queryByText(/×/)).toBeNull();
  });

  it('gives the truncated name a title attribute', () => {
    const list = renderList();
    const [copper] = within(list).getAllByRole('listitem');
    expect(within(copper).getByText('Copper Bar')).toHaveAttribute('title', 'Copper Bar');
  });
});

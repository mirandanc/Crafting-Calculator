import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuctionHint } from '@/components/AuctionHint/AuctionHint';

describe('AuctionHint', () => {
  it('renders nothing for "none"', () => {
    const { container } = render(<AuctionHint hint={{ kind: 'none' }} itemName="Copper Bar" onRestore={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('tags an item that is not on the auction house', () => {
    render(<AuctionHint hint={{ kind: 'notListed' }} itemName="Tin Bar" onRestore={vi.fn()} />);
    expect(screen.getByText('Not on AH')).toBeInTheDocument();
  });

  it('offers the auction price back, naming it', async () => {
    const onRestore = vi.fn();
    render(<AuctionHint hint={{ kind: 'restore', copper: 1240 }} itemName="Copper Bar" onRestore={onRestore} />);
    const button = screen.getByRole('button', { name: 'Use the auction price for Copper Bar (12s 40c)' });
    expect(button).toHaveAttribute('title', 'Use the auction price (12s 40c)');
    await userEvent.click(button);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});

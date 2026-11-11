import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PriceHint } from '@/components/PriceHint/PriceHint';

describe('PriceHint', () => {
  it('renders nothing for "none"', () => {
    const { container } = render(<PriceHint hint={{ kind: 'none' }} itemName="Copper Bar" onRestore={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('tags an item that is not on the auction house', () => {
    render(<PriceHint hint={{ kind: 'notListed' }} itemName="Tin Bar" onRestore={vi.fn()} />);
    expect(screen.getByText('Not on AH')).toBeInTheDocument();
  });

  it('offers the auction price back, naming it', async () => {
    const onRestore = vi.fn();
    render(<PriceHint hint={{ kind: 'restore', copper: 1240, source: 'auction' }} itemName="Copper Bar" onRestore={onRestore} />);
    const button = screen.getByRole('button', { name: 'Use the auction price for Copper Bar (12s 40c)' });
    expect(button).toHaveAttribute('title', 'Use the auction price (12s 40c)');
    await userEvent.click(button);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('tags a vendor-filled price', () => {
    render(<PriceHint hint={{ kind: 'vendor' }} itemName="Tin Bar" onRestore={vi.fn()} />);
    expect(screen.getByText('Vendor')).toBeInTheDocument();
  });

  it('names the vendor when it offers a vendor price back', () => {
    render(<PriceHint hint={{ kind: 'restore', copper: 200, source: 'vendor' }} itemName="Tin Bar" onRestore={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Use the vendor price for Tin Bar (2s)' })).toHaveAttribute(
      'title',
      'Use the vendor price (2s)',
    );
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from '@/components/Footer/Footer';

describe('Footer', () => {
  it('credits ForeverDB with a link to its site', () => {
    render(<Footer auctionStatus={null} />);
    expect(screen.getByRole('link', { name: 'Data by ForeverDB.net' })).toHaveAttribute('href', 'https://foreverdb.net');
  });

  it('shows the auction status above the credit, in the warning style when stale', () => {
    const { rerender } = render(<Footer auctionStatus={{ text: 'Auction prices updated 5 h ago · US Alliance', stale: false }} />);
    const line = screen.getByText('Auction prices updated 5 h ago · US Alliance');
    expect(line).not.toHaveAttribute('data-stale');
    rerender(<Footer auctionStatus={{ text: 'Auction prices are 3 days old · US Alliance', stale: true }} />);
    expect(screen.getByText('Auction prices are 3 days old · US Alliance')).toHaveAttribute('data-stale', 'true');
  });

  it('keeps an empty status line while auction prices load', () => {
    render(<Footer auctionStatus={null} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionNotice } from '@/components/ConnectionNotice/ConnectionNotice';

describe('ConnectionNotice', () => {
  it('says the connection is lost', () => {
    render(<ConnectionNotice lost />);
    expect(screen.getByRole('status')).toHaveTextContent('Lost touch with ForeverDB. Item search will try again as you type.');
  });

  it('stays mounted but empty while the connection is fine', () => {
    render(<ConnectionNotice lost={false} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

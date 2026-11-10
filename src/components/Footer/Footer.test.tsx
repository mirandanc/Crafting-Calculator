import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from '@/components/Footer/Footer';

describe('Footer', () => {
  it('credits ForeverDB with a link to its site', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'Data by ForeverDB.net' })).toHaveAttribute('href', 'https://foreverdb.net');
  });
});

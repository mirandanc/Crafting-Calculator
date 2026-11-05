import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoneyText } from '@/components/MoneyText/MoneyText';
import { formatMoney } from '@/money/money';

describe('MoneyText', () => {
  it.each([0, 5, 100, 125, 10_000, 10_105, 123_456_789])('reads %i copper as formatMoney text', (copper) => {
    render(<MoneyText copper={copper} />);
    expect(screen.getByText(formatMoney(copper))).toHaveClass('sr-only');
  });

  it('puts the prefix in the accessible text only', () => {
    const { container } = render(<MoneyText copper={50} srPrefix="= " />);
    expect(screen.getByText('= 50c')).toHaveClass('sr-only');
    const visible = Array.from(container.querySelectorAll('[aria-hidden="true"]'));
    expect(visible.map((node) => node.textContent).join('')).not.toContain('=');
  });

  it('draws only the non-zero parts, each with its coin', () => {
    const { container } = render(<MoneyText copper={10_005} />);
    const parts = Array.from(container.querySelectorAll('span[aria-hidden="true"]'));
    expect(parts.map((part) => part.textContent)).toEqual(['1', '5']);
    expect(parts.map((part) => part.querySelector('img')?.getAttribute('src'))).toEqual([
      expect.stringContaining('gold'),
      expect.stringContaining('copper'),
    ]);
  });

  it('groups gold thousands like formatMoney', () => {
    const { container } = render(<MoneyText copper={12_345 * 10_000} />);
    expect(container.querySelector('span[aria-hidden="true"]')?.textContent).toBe('12,345');
  });
});

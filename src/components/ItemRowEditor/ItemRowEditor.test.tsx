import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemRowEditor } from '@/components/ItemRowEditor/ItemRowEditor';
import type { Coins } from '@/money/money';
import { createItemRow } from '@/sheet/sheet';

const NO_PRICE: Coins = { gold: 0, silver: 0, copper: 0 };

describe('ItemRowEditor', () => {
  it('names the quantity field "Quantity", matching its visible caption', () => {
    render(
      <ItemRowEditor
        row={createItemRow()}
        position={1}
        price={NO_PRICE}
        onRename={vi.fn()}
        onLink={vi.fn()}
        onQuantityChange={vi.fn()}
        onPriceChange={vi.fn()}
        onPriceBlur={vi.fn()}
        onRemove={vi.fn()}
        onReachable={vi.fn()}
      />,
    );
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
  });
});

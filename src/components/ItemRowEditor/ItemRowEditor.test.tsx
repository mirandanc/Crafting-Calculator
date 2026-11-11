import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ItemRowEditor } from '@/components/ItemRowEditor/ItemRowEditor';
import type { Coins } from '@/money/money';
import { createItemRow, type ItemRow } from '@/sheet/sheet';

const NO_PRICE: Coins = { gold: 0, silver: 0, copper: 0 };

const renderRow = (row: ItemRow) =>
  render(
    <ItemRowEditor
      row={row}
      position={1}
      price={NO_PRICE}
      hint={{ kind: 'none' }}
      onRename={vi.fn()}
      onLink={vi.fn()}
      onQuantityChange={vi.fn()}
      onPriceChange={vi.fn()}
      onPriceBlur={vi.fn()}
      onRestorePrice={vi.fn()}
      onRemove={vi.fn()}
      onReachable={vi.fn()}
    />,
  );

describe('ItemRowEditor', () => {
  it('names the quantity field "Quantity", matching its visible caption', () => {
    render(
      <ItemRowEditor
        row={createItemRow()}
        position={1}
        price={NO_PRICE}
        hint={{ kind: 'none' }}
        onRename={vi.fn()}
        onLink={vi.fn()}
        onQuantityChange={vi.fn()}
        onPriceChange={vi.fn()}
        onPriceBlur={vi.fn()}
        onRestorePrice={vi.fn()}
        onRemove={vi.fn()}
        onReachable={vi.fn()}
      />,
    );
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
  });

  it('disables the price until the item has a name', () => {
    const { unmount } = renderRow({ ...createItemRow(), name: '  ' });
    for (const coin of ['gold', 'silver', 'copper']) {
      expect(screen.getByLabelText(`Unit price ${coin}`)).toBeDisabled();
    }
    expect(screen.getByRole('group', { name: 'Unit price' })).toHaveAccessibleDescription('Name the item first');
    unmount();
    renderRow({ ...createItemRow(), name: 'Linen Cloth' });
    expect(screen.getByLabelText('Unit price copper')).toBeEnabled();
    expect(screen.queryByText('Name the item first')).not.toBeInTheDocument();
  });

  it('offers the auction price back, naming the item', async () => {
    const onRestorePrice = vi.fn();
    render(
      <ItemRowEditor
        row={{ ...createItemRow(), name: ' Linen Cloth ' }}
        position={1}
        price={NO_PRICE}
        hint={{ kind: 'restore', copper: 30, source: 'auction' }}
        onRename={vi.fn()}
        onLink={vi.fn()}
        onQuantityChange={vi.fn()}
        onPriceChange={vi.fn()}
        onPriceBlur={vi.fn()}
        onRestorePrice={onRestorePrice}
        onRemove={vi.fn()}
        onReachable={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Use the auction price for Linen Cloth (30c)' }));
    expect(onRestorePrice).toHaveBeenCalledTimes(1);
  });

  it('invites a search in the name field', () => {
    renderRow(createItemRow());
    expect(screen.getByRole('combobox', { name: 'Item name' })).toHaveAttribute('placeholder', 'Search an item');
  });
});

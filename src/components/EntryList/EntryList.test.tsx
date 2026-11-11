import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EntryList } from '@/components/EntryList/EntryList';
import type { MarketPricesByKey } from '@/prices/marketPrices';
import { createRecipeBlock, withoutEntry, type Entry, type Prices } from '@/sheet/sheet';
import type { SheetActions } from '@/sheet/useSheet';
import { coins, itemRow as namedItemRow } from '@/test/sheetFixtures';

const itemRow = (id: string): Entry => ({ kind: 'item', id, name: '', itemId: null, icon: null, quantity: null });

type HarnessProps = {
  initialEntries: Entry[];
  typedPrices?: Prices;
  /** Given, the auction list counts as loaded. */
  marketByKey?: MarketPricesByKey;
  onClearPrice?: (key: string) => void;
  professions?: string[];
};

function Harness({ initialEntries, typedPrices = {}, marketByKey, onClearPrice = () => {}, professions = [] }: HarnessProps) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const actions: SheetActions = {
    addRecipe: () => setEntries((current) => [...current, createRecipeBlock()]),
    addItem: () => setEntries((current) => [...current, createRecipeBlock()]),
    removeEntry: (id) => setEntries((current) => withoutEntry(current, id)),
    eraseAll: () => setEntries([createRecipeBlock()]),
    chooseRecipe: () => {},
    addCraftedRecipe: () => {},
    setWanted: () => {},
    removeReagent: () => {},
    renameItem: () => {},
    linkItem: () => {},
    setItemQuantity: () => {},
    setPrice: () => {},
    normalizePrice: () => {},
    clearPrice: onClearPrice,
    setMuted: () => {},
  };
  return (
    <EntryList
      entries={entries}
      prices={typedPrices}
      typedPrices={typedPrices}
      marketByKey={marketByKey ?? {}}
      auctionLoaded={marketByKey !== undefined}
      catalog={null}
      professions={professions}
      actions={actions}
      onReachable={() => {}}
    />
  );
}

const activeEntryId = (): string | null =>
  document.activeElement?.closest('[data-entry-id]')?.getAttribute('data-entry-id') ?? null;

describe('EntryList', () => {
  it('names the confirm group after the question', () => {
    render(<Harness initialEntries={[itemRow('a')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Erase the page' }));
    expect(screen.getByRole('group', { name: 'Clear every recipe and item?' })).toBeInTheDocument();
  });

  it('cancels the erase confirmation on Escape and returns focus to "Erase the page"', () => {
    render(<Harness initialEntries={[itemRow('a')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Erase the page' }));
    const group = screen.getByRole('group', { name: 'Clear every recipe and item?' });

    fireEvent.keyDown(group, { key: 'Escape' });

    expect(screen.queryByRole('group', { name: 'Clear every recipe and item?' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Erase the page' })).toHaveFocus();
  });

  it('moves focus to the next entry, then the previous, then "Add recipe" as entries are removed', () => {
    render(<Harness initialEntries={[itemRow('a'), itemRow('b'), itemRow('c')]} />);

    // Removing the middle entry: focus goes to what was the next entry ('c').
    fireEvent.click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect(activeEntryId()).toBe('c');

    // Removing the now-last entry ('c', at position 2): no next, so focus goes to the previous ('a').
    fireEvent.click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect(activeEntryId()).toBe('a');

    // Removing the only remaining entry: no next, no previous, so focus goes to "Add recipe".
    fireEvent.click(screen.getByRole('button', { name: 'Remove item 1' }));
    expect(screen.getByRole('button', { name: 'Add recipe' })).toHaveFocus();
  });

  it('wires item rows to the auction prices, with no hint on a nameless row', () => {
    const onClearPrice = vi.fn();
    render(
      <Harness
        initialEntries={[namedItemRow('a', 'Tin Bar', 1, 3576), namedItemRow('b', 'Copper Ore', 1, 2770), namedItemRow('c', '', 1, 2771)]}
        typedPrices={{ 'name:tin bar': coins(10) }}
        marketByKey={{ 'name:tin bar': { copper: 50, source: 'auction' } }}
        onClearPrice={onClearPrice}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use the auction price for Tin Bar (50c)' }));
    expect(onClearPrice).toHaveBeenCalledWith('name:tin bar');
    // Copper Ore is linked, unpriced and not listed; the nameless row has no price key, so no tag.
    expect(screen.getAllByText('Not on AH')).toHaveLength(1);
  });
});

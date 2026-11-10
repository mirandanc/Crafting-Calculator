import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { EntryList } from '@/components/EntryList/EntryList';
import { createRecipeBlock, withoutEntry, type Entry } from '@/sheet/sheet';
import type { SheetActions } from '@/sheet/useSheet';

const itemRow = (id: string): Entry => ({ kind: 'item', id, name: '', itemId: null, icon: null, quantity: null });

type HarnessProps = {
  initialEntries: Entry[];
};

function Harness({ initialEntries }: HarnessProps) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const actions: SheetActions = {
    addRecipe: () => setEntries((current) => [...current, createRecipeBlock()]),
    addItem: () => setEntries((current) => [...current, createRecipeBlock()]),
    removeEntry: (id) => setEntries((current) => withoutEntry(current, id)),
    eraseAll: () => setEntries([createRecipeBlock()]),
    chooseRecipe: () => {},
    setWanted: () => {},
    removeReagent: () => {},
    renameItem: () => {},
    linkItem: () => {},
    setItemQuantity: () => {},
    setPrice: () => {},
    normalizePrice: () => {},
    clearPrice: () => {},
    setMuted: () => {},
  };
  return <EntryList entries={entries} prices={{}} catalog={null} actions={actions} onReachable={() => {}} />;
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
});

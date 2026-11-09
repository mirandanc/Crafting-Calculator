import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Entry } from '@/sheet/sheet';
import { loadSheet } from '@/sheet/storage';
import { useSheet } from '@/sheet/useSheet';
import { TEST_CATALOG, testRecipe } from '@/test/catalogFixture';

const reagentCount = (entry: Entry): number | null => (entry.kind === 'recipe' ? (entry.recipe?.reagents.length ?? null) : null);

describe('useSheet', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with one empty recipe block', () => {
    const { result } = renderHook(() => useSheet());
    expect(result.current.sheet.entries).toHaveLength(1);
    expect(result.current.sheet.entries[0].kind).toBe('recipe');
  });

  it('adds recipe blocks and item rows, and never leaves the page empty', () => {
    const { result } = renderHook(() => useSheet());
    act(() => result.current.actions.addItem());
    act(() => result.current.actions.addRecipe());
    expect(result.current.sheet.entries.map((entry) => entry.kind)).toEqual(['recipe', 'item', 'recipe']);
    for (const entry of [...result.current.sheet.entries]) {
      act(() => result.current.actions.removeEntry(entry.id));
    }
    expect(result.current.sheet.entries).toHaveLength(1);
  });

  it('picks a recipe, removes a reagent, and restores it on re-pick', () => {
    const { result } = renderHook(() => useSheet());
    const id = result.current.sheet.entries[0].id;
    act(() => result.current.actions.chooseRecipe(id, testRecipe('Smelt Bronze'), TEST_CATALOG.items));
    act(() => result.current.actions.removeReagent(id, 2840));
    expect(reagentCount(result.current.sheet.entries[0])).toBe(1);
    act(() => result.current.actions.chooseRecipe(id, testRecipe('Smelt Bronze'), TEST_CATALOG.items));
    expect(reagentCount(result.current.sheet.entries[0])).toBe(2);
  });

  it('shares prices by key and normalizes them on demand', () => {
    const { result } = renderHook(() => useSheet());
    act(() => result.current.actions.setPrice('name:copper bar', { gold: 0, silver: 0, copper: 150 }));
    act(() => result.current.actions.normalizePrice('name:copper bar'));
    expect(result.current.sheet.prices['name:copper bar']).toEqual({ gold: 0, silver: 1, copper: 50 });
  });

  it('unlinks an item row when its name is typed', () => {
    const { result } = renderHook(() => useSheet());
    act(() => result.current.actions.addItem());
    const id = result.current.sheet.entries[1].id;
    act(() =>
      result.current.actions.linkItem(id, { itemId: 2840, name: 'Copper Bar', icon: 'https://foreverdb.net/icons/133216.webp' }),
    );
    expect(result.current.sheet.entries[1]).toMatchObject({ itemId: 2840 });
    act(() => result.current.actions.renameItem(id, 'Copper Bars'));
    expect(result.current.sheet.entries[1]).toMatchObject({ name: 'Copper Bars', itemId: null, icon: null });
  });

  it('erases entries and prices but keeps the mute setting', () => {
    const { result } = renderHook(() => useSheet());
    act(() => result.current.actions.addItem());
    act(() => result.current.actions.setPrice('name:copper bar', { gold: 0, silver: 0, copper: 10 }));
    act(() => result.current.actions.setMuted(true));
    act(() => result.current.actions.eraseAll());
    expect(result.current.sheet.entries).toHaveLength(1);
    expect(result.current.sheet.prices).toEqual({});
    expect(result.current.sheet.muted).toBe(true);
  });

  it('saves every change', () => {
    const { result } = renderHook(() => useSheet());
    act(() => result.current.actions.addItem());
    expect(loadSheet()?.entries).toHaveLength(2);
  });
});

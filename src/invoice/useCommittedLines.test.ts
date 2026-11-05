import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommittedLines } from '@/invoice/useCommittedLines';
import type { ItemCard } from '@/recipe/recipe';

type HookProps = { cards: ItemCard[] };

const filled = (id: string, quantity = 2): ItemCard => ({
  id,
  name: 'Copper Bar',
  quantity,
  price: { gold: 0, silver: 0, copper: 25 },
});
const empty = (id: string): ItemCard => ({ id, name: '', quantity: null, price: { gold: 0, silver: 0, copper: 0 } });

const setup = (cards: ItemCard[]) => {
  const onAdded = vi.fn();
  const hook = renderHook(({ cards: current }: HookProps) => useCommittedLines(current, onAdded), {
    initialProps: { cards },
  });
  return { ...hook, onAdded };
};

const ids = (cards: ItemCard[]): string[] => cards.map((card) => card.id);

describe('useCommittedLines', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows cards already filled on first render without announcing them', () => {
    const { result, onAdded } = setup([filled('a')]);
    expect(ids(result.current)).toEqual(['a']);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('adds a newly filled card after 800 ms and announces it once', () => {
    const { result, rerender, onAdded } = setup([empty('a')]);
    rerender({ cards: [filled('a')] });
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(result.current).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(ids(result.current)).toEqual(['a']);
    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  it('restarts the delay on every change', () => {
    const { result, rerender } = setup([empty('a')]);
    rerender({ cards: [filled('a', 2)] });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender({ cards: [filled('a', 3)] });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(ids(result.current)).toEqual(['a']);
  });

  it('updates a row already on the invoice immediately and silently', () => {
    const { result, rerender, onAdded } = setup([filled('a', 2)]);
    rerender({ cards: [filled('a', 5)] });
    expect(result.current[0].quantity).toBe(5);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('drops a card that becomes incomplete at once, and re-adds it with an announcement', () => {
    const { result, rerender, onAdded } = setup([filled('a')]);
    rerender({ cards: [empty('a')] });
    expect(result.current).toEqual([]);
    rerender({ cards: [filled('a')] });
    expect(result.current).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(ids(result.current)).toEqual(['a']);
    expect(onAdded).toHaveBeenCalledTimes(1);
  });
});

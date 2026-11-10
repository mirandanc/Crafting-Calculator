import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry, Prices } from '@/sheet/sheet';
import { useChimeOnFullyPriced } from '@/sound/useChimeOnFullyPriced';
import { coins, itemRow } from '@/test/sheetFixtures';

type HookProps = {
  entries: Entry[];
  prices: Prices;
};

const PRICED: Prices = { 'name:linen cloth': coins(25), 'name:wool cloth': coins(40) };

const linen = (quantity = 2): Entry[] => [itemRow('a', 'Linen Cloth', quantity)];

const setup = (entries: Entry[], prices: Prices) => {
  const onChime = vi.fn();
  const hook = renderHook((props: HookProps) => useChimeOnFullyPriced(props.entries, props.prices, onChime), {
    initialProps: { entries, prices },
  });
  return { ...hook, onChime };
};

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('useChimeOnFullyPriced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays silent for entries already priced when the page loads', () => {
    const { onChime } = setup(linen(), PRICED);
    wait(800);
    expect(onChime).not.toHaveBeenCalled();
  });

  it('chimes once, 800 ms after an entry becomes fully priced', () => {
    const { rerender, onChime } = setup(linen(), {});
    rerender({ entries: linen(), prices: PRICED });
    wait(799);
    expect(onChime).not.toHaveBeenCalled();
    wait(1);
    expect(onChime).toHaveBeenCalledTimes(1);
  });

  it('restarts the delay on every change', () => {
    const { rerender, onChime } = setup(linen(), {});
    rerender({ entries: linen(2), prices: PRICED });
    wait(500);
    rerender({ entries: linen(3), prices: PRICED });
    wait(500);
    expect(onChime).not.toHaveBeenCalled();
    wait(300);
    expect(onChime).toHaveBeenCalledTimes(1);
  });

  it('does not chime again while an entry stays fully priced', () => {
    const { rerender, onChime } = setup(linen(2), PRICED);
    rerender({ entries: linen(5), prices: PRICED });
    wait(800);
    expect(onChime).not.toHaveBeenCalled();
  });

  it('chimes again after an entry loses its price and gets it back', () => {
    const { rerender, onChime } = setup(linen(), PRICED);
    rerender({ entries: linen(), prices: {} });
    wait(800);
    rerender({ entries: linen(), prices: PRICED });
    wait(800);
    expect(onChime).toHaveBeenCalledTimes(1);
  });

  it('does not chime when priced, briefly unpriced, then priced again inside the same window', () => {
    const { rerender, onChime } = setup(linen(), PRICED);
    rerender({ entries: linen(), prices: {} });
    wait(400);
    rerender({ entries: linen(), prices: PRICED });
    wait(800);
    expect(onChime).not.toHaveBeenCalled();
  });

  it('calls the latest onChime callback, not the one from the first render', () => {
    const firstOnChime = vi.fn();
    const secondOnChime = vi.fn();
    const { rerender } = renderHook((props: HookProps & { onChime: () => void }) => useChimeOnFullyPriced(props.entries, props.prices, props.onChime), {
      initialProps: { entries: linen(), prices: {}, onChime: firstOnChime },
    });
    rerender({ entries: linen(), prices: PRICED, onChime: secondOnChime });
    wait(800);
    expect(firstOnChime).not.toHaveBeenCalled();
    expect(secondOnChime).toHaveBeenCalledTimes(1);
  });

  it('chimes once for two entries priced in the same window', () => {
    const both: Entry[] = [itemRow('a', 'Linen Cloth', 1), itemRow('b', 'Wool Cloth', 1)];
    const { rerender, onChime } = setup(both, {});
    rerender({ entries: [...both], prices: PRICED });
    wait(800);
    expect(onChime).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending chime on unmount', () => {
    const { rerender, unmount, onChime } = setup(linen(), {});
    rerender({ entries: linen(), prices: PRICED });
    unmount();
    wait(800);
    expect(onChime).not.toHaveBeenCalled();
  });
});

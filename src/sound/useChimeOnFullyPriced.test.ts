import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry, Prices } from '@/sheet/sheet';
import { useChimeOnFullyPriced } from '@/sound/useChimeOnFullyPriced';
import { coins, itemRow } from '@/test/sheetFixtures';

type HookProps = {
  entries: Entry[];
  prices: Prices;
  typed: Prices;
  auctionStamp: string | null;
};

type HookPropsWithCallback = HookProps & {
  onChime: () => void;
};

const PRICED: Prices = { 'name:linen cloth': coins(25), 'name:wool cloth': coins(40) };

const linen = (quantity = 2): Entry[] => [itemRow('a', 'Linen Cloth', quantity)];

const setup = (entries: Entry[], prices: Prices, typed: Prices = prices, auctionStamp: string | null = null) => {
  const onChime = vi.fn();
  const hook = renderHook(
    (props: HookProps) =>
      useChimeOnFullyPriced(
        { entries: props.entries, prices: props.prices, typedPrices: props.typed, auctionStamp: props.auctionStamp },
        onChime,
      ),
    { initialProps: { entries, prices, typed, auctionStamp } },
  );
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
    rerender({ entries: linen(), prices: PRICED, typed: PRICED, auctionStamp: null });
    wait(799);
    expect(onChime).not.toHaveBeenCalled();
    wait(1);
    expect(onChime).toHaveBeenCalledTimes(1);
  });

  it('restarts the delay on every change', () => {
    const { rerender, onChime } = setup(linen(), {});
    rerender({ entries: linen(2), prices: PRICED, typed: PRICED, auctionStamp: null });
    wait(500);
    rerender({ entries: linen(3), prices: PRICED, typed: PRICED, auctionStamp: null });
    wait(500);
    expect(onChime).not.toHaveBeenCalled();
    wait(300);
    expect(onChime).toHaveBeenCalledTimes(1);
  });

  it('does not chime again while an entry stays fully priced', () => {
    const { rerender, onChime } = setup(linen(2), PRICED);
    rerender({ entries: linen(5), prices: PRICED, typed: PRICED, auctionStamp: null });
    wait(800);
    expect(onChime).not.toHaveBeenCalled();
  });

  it('chimes again after an entry loses its price and gets it back', () => {
    const { rerender, onChime } = setup(linen(), PRICED);
    rerender({ entries: linen(), prices: {}, typed: {}, auctionStamp: null });
    wait(800);
    rerender({ entries: linen(), prices: PRICED, typed: PRICED, auctionStamp: null });
    wait(800);
    expect(onChime).toHaveBeenCalledTimes(1);
  });

  it('does not chime when priced, briefly unpriced, then priced again inside the same window', () => {
    const { rerender, onChime } = setup(linen(), PRICED);
    rerender({ entries: linen(), prices: {}, typed: {}, auctionStamp: null });
    wait(400);
    rerender({ entries: linen(), prices: PRICED, typed: PRICED, auctionStamp: null });
    wait(800);
    expect(onChime).not.toHaveBeenCalled();
  });

  it('calls the latest onChime callback, not the one from the first render', () => {
    const firstOnChime = vi.fn();
    const secondOnChime = vi.fn();
    const { rerender } = renderHook(
      (props: HookPropsWithCallback) =>
        useChimeOnFullyPriced(
          { entries: props.entries, prices: props.prices, typedPrices: props.typed, auctionStamp: props.auctionStamp },
          props.onChime,
        ),
      { initialProps: { entries: linen(), prices: {}, typed: {}, auctionStamp: null, onChime: firstOnChime } },
    );
    rerender({ entries: linen(), prices: PRICED, typed: PRICED, auctionStamp: null, onChime: secondOnChime });
    wait(800);
    expect(firstOnChime).not.toHaveBeenCalled();
    expect(secondOnChime).toHaveBeenCalledTimes(1);
  });

  it('chimes once for two entries priced in the same window', () => {
    const both: Entry[] = [itemRow('a', 'Linen Cloth', 1), itemRow('b', 'Wool Cloth', 1)];
    const { rerender, onChime } = setup(both, {});
    rerender({ entries: [...both], prices: PRICED, typed: PRICED, auctionStamp: null });
    wait(800);
    expect(onChime).toHaveBeenCalledTimes(1);
  });

  it('stays silent when an entry is fully priced by the auction alone', () => {
    const { rerender, onChime } = setup(linen(), {}, {}, 'a');
    rerender({ entries: linen(), prices: PRICED, typed: {}, auctionStamp: 'a' });
    wait(800);
    expect(onChime).not.toHaveBeenCalled();
  });

  it('stays silent when the auction prices arrive, even for entries with typed prices', () => {
    const typed: Prices = { 'name:linen cloth': coins(25) };
    const { rerender, onChime } = setup(linen(), {}, {}, null);
    rerender({ entries: linen(), prices: PRICED, typed, auctionStamp: '2026-11-10T16:00:00.000Z' });
    wait(800);
    expect(onChime).not.toHaveBeenCalled();
  });

  it('chimes when a typed price completes an entry the auction partly priced', () => {
    const entries: Entry[] = [itemRow('a', 'Linen Cloth', 2)];
    const { rerender, onChime } = setup(entries, {}, {}, 'a');
    rerender({ entries, prices: PRICED, typed: { 'name:linen cloth': coins(25) }, auctionStamp: 'a' });
    wait(800);
    expect(onChime).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending chime on unmount', () => {
    const { rerender, unmount, onChime } = setup(linen(), {});
    rerender({ entries: linen(), prices: PRICED, typed: PRICED, auctionStamp: null });
    unmount();
    wait(800);
    expect(onChime).not.toHaveBeenCalled();
  });
});

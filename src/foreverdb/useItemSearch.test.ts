import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForeverItem } from '@/foreverdb/itemSearch';
import { useItemSearch } from '@/foreverdb/useItemSearch';

type HookProps = {
  query: string;
};

const COPPER: ForeverItem = {
  id: 2840,
  name: 'Copper Bar',
  icon: 'https://foreverdb.net/icons/133216.webp',
  speculation: false,
  betaEvent: false,
};

const okResponse = (): Response => new Response(JSON.stringify({ data: [COPPER, { ...COPPER, id: 1, betaEvent: true }] }));

const setup = (query: string) => {
  const onReachable = vi.fn();
  const hook = renderHook((props: HookProps) => useItemSearch(props.query, onReachable), { initialProps: { query } });
  return { ...hook, onReachable };
};

const flush = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('useItemSearch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not search below 3 letters', async () => {
    const { result } = setup('co');
    await flush(300);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('waits 300 ms after the last keystroke, then shows filtered results', async () => {
    const { result, rerender, onReachable } = setup('cop');
    await flush(200);
    rerender({ query: 'copp' });
    await flush(299);
    expect(fetchMock).not.toHaveBeenCalled();
    await flush(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/items?q=copp');
    expect(result.current).toEqual([COPPER]);
    expect(onReachable).toHaveBeenLastCalledWith(true);
  });

  it('reports a failed search and shows nothing', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    const { result, onReachable } = setup('copper');
    await flush(300);
    expect(result.current).toEqual([]);
    expect(onReachable).toHaveBeenLastCalledWith(false);
  });

  it('reports success again after a failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    const { rerender, onReachable } = setup('copper');
    await flush(300);
    rerender({ query: 'copper b' });
    await flush(300);
    expect(onReachable.mock.calls.map((call) => call[0])).toEqual([false, true]);
  });

  it('clears results when the query gets too short', async () => {
    const { result, rerender } = setup('copper');
    await flush(300);
    expect(result.current).toHaveLength(1);
    rerender({ query: 'co' });
    expect(result.current).toEqual([]);
  });

  it('aborts a request that is no longer wanted', async () => {
    let firstSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          firstSignal = init.signal ?? undefined;
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const { rerender, onReachable } = setup('copper');
    await flush(300);
    rerender({ query: 'tin bar' });
    expect(firstSignal?.aborted).toBe(true);
    await flush(300);
    expect(onReachable).not.toHaveBeenCalledWith(false);
    expect(onReachable).toHaveBeenLastCalledWith(true);
  });
});

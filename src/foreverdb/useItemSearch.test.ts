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

  it('does not search a whitespace-only query', async () => {
    const { result } = setup('    ');
    await flush(300);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('does not search above 80 characters after trimming', async () => {
    const { result } = setup(`  ${'a'.repeat(81)}  `);
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

  it('does not send a second request when only surrounding whitespace changes', async () => {
    const { rerender } = setup('copper');
    await flush(300);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender({ query: 'copper ' });
    await flush(300);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('treats a 4xx response as no results while staying reachable', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    const { result, onReachable } = setup('copper');
    await flush(300);
    expect(result.current).toEqual([]);
    expect(onReachable).toHaveBeenLastCalledWith(true);
  });

  it('clears results when the query gets too short', async () => {
    const { result, rerender } = setup('copper');
    await flush(300);
    expect(result.current).toHaveLength(1);
    rerender({ query: 'co' });
    expect(result.current).toEqual([]);
  });

  it('hides stale results once the query changes', async () => {
    const { result, rerender } = setup('copper');
    await flush(300);
    expect(result.current).toHaveLength(1);
    rerender({ query: 'copper bar' });
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

  it('drops a late response from a fetch that ignores the abort signal', async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const { result, rerender } = setup('cop');
    await flush(300);
    rerender({ query: 'copper' });
    await flush(300);
    expect(result.current).toEqual([COPPER]);
    resolveFirst?.(okResponse());
    await flush(0);
    expect(result.current).toEqual([COPPER]);
  });

  it('aborts the request on unmount and calls nothing afterwards', async () => {
    let settle: (() => void) | undefined;
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          settle = () => resolve(okResponse());
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const { onReachable, unmount } = setup('copper');
    await flush(300);
    unmount();
    settle?.();
    await flush(0);
    expect(onReachable).not.toHaveBeenCalled();
  });
});

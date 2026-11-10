import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_CATALOG } from '@/test/catalogFixture';

const freshHook = async () => {
  vi.resetModules();
  const module = await import('@/recipes/useRecipeCatalog');
  return module.useRecipeCatalog;
};

describe('useRecipeCatalog', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleErrorSpy.mockRestore();
  });

  it('returns the catalog once it loads', async () => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify(TEST_CATALOG)));
    vi.stubGlobal('fetch', fetchMock);
    const useRecipeCatalog = await freshHook();

    const { result } = renderHook(() => useRecipeCatalog());
    expect(result.current).toEqual({ catalog: null, failed: false });
    await waitFor(() => expect(result.current).toEqual({ catalog: TEST_CATALOG, failed: false }));
  });

  it('reports a failed load, logs it and allows a retry on the next mount', async () => {
    fetchMock = vi.fn(async () => new Response('missing', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const useRecipeCatalog = await freshHook();

    const first = renderHook(() => useRecipeCatalog());
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(first.result.current).toEqual({ catalog: null, failed: true });
    first.unmount();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(TEST_CATALOG)));
    const second = renderHook(() => useRecipeCatalog());
    expect(second.result.current).toEqual({ catalog: null, failed: false });
    await waitFor(() => expect(second.result.current).toEqual({ catalog: TEST_CATALOG, failed: false }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

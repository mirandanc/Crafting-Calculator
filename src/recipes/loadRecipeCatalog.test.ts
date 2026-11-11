// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_CATALOG } from '@/test/catalogFixture';

const freshLoader = async () => {
  vi.resetModules();
  const module = await import('@/recipes/loadRecipeCatalog');
  return module.loadRecipeCatalog;
};

describe('loadRecipeCatalog', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify(TEST_CATALOG)));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the bundled JSON once and shares it', async () => {
    const loadRecipeCatalog = await freshLoader();
    const [first, second] = await Promise.all([loadRecipeCatalog(), loadRecipeCatalog()]);
    expect(first).toEqual(TEST_CATALOG);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('recipes');
  });

  it('tries again after a failed load', async () => {
    fetchMock.mockResolvedValueOnce(new Response('missing', { status: 404 }));
    const loadRecipeCatalog = await freshLoader();
    await expect(loadRecipeCatalog()).rejects.toThrow('Recipe catalog request failed: 404');
    await expect(loadRecipeCatalog()).resolves.toEqual(TEST_CATALOG);
  });

  it('gives a catalog written before vendor prices existed empty vendor prices', async () => {
    // JSON.stringify drops the undefined field, like a file from before vendor prices.
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...TEST_CATALOG, vendorPrices: undefined })));
    const loadRecipeCatalog = await freshLoader();
    expect((await loadRecipeCatalog()).vendorPrices).toEqual({});
  });
});

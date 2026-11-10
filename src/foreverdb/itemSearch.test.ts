// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchItems, pickItemMatches, type ForeverItem } from '@/foreverdb/itemSearch';

const item = (id: number, name: string, overrides: Partial<ForeverItem> = {}): ForeverItem => ({
  id,
  name,
  icon: `https://foreverdb.net/icons/${id}.webp`,
  speculation: false,
  betaEvent: false,
  ...overrides,
});

describe('fetchItems', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the Worker with the trimmed query and returns the items', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [item(2840, 'Copper Bar')] })));
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;

    expect(await fetchItems('  copper bar ', signal)).toEqual([item(2840, 'Copper Bar')]);
    expect(fetchMock).toHaveBeenCalledWith('/api/items?q=copper%20bar', { signal });
  });

  it('throws when the Worker answers with an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })));
    await expect(fetchItems('copper', new AbortController().signal)).rejects.toThrow('Item search failed: 502');
  });

  it('throws when the response body is not a list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: 'not a list' }))));
    await expect(fetchItems('copper', new AbortController().signal)).rejects.toThrow('Item search failed: invalid response');
  });
});

describe('pickItemMatches', () => {
  it('hides speculation and beta-event items, then ranks exact, prefix, contains', () => {
    const items = [
      item(1, 'Smelted Copper Bar'),
      item(2, 'Copper Bar'),
      item(3, 'Copper Bar', { betaEvent: true }),
      item(4, 'Copper Bar Mold'),
      item(5, 'Copper Bar Prototype', { speculation: true }),
    ];
    expect(pickItemMatches(items, 'copper bar').map((match) => match.id)).toEqual([2, 4, 1]);
  });

  it('keeps 8 results', () => {
    const items = Array.from({ length: 12 }, (_, index) => item(index + 1, `Copper ${index}`));
    expect(pickItemMatches(items, 'copper')).toHaveLength(8);
  });
});

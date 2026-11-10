// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRequest, routeApi, type PriceStore, type ProxyContext, type ResponseCache } from '@worker/proxy';

type FakeKv = PriceStore & {
  value: string | null;
  get: ReturnType<typeof vi.fn>;
};

type FakeCache = ResponseCache & {
  stored: Map<string, Response>;
};

type TestContext = {
  context: ProxyContext;
  cache: FakeCache;
  assetFetch: ReturnType<typeof vi.fn>;
  pending: Promise<unknown>[];
  kv: FakeKv;
};

const createFakeCache = (): FakeCache => {
  const stored = new Map<string, Response>();
  return {
    stored,
    match: async (key) => stored.get(key.url)?.clone(),
    put: async (key, response) => {
      stored.set(key.url, response);
    },
  };
};

const createContext = (): TestContext => {
  const cache = createFakeCache();
  const pending: Promise<unknown>[] = [];
  const assetFetch = vi.fn(async () => new Response('asset'));
  const kv: FakeKv = { value: null, get: vi.fn(async () => kv.value) };
  const context: ProxyContext = {
    env: { FOREVERDB_API_KEY: 'test-key', AUCTION_PRICES: kv },
    assets: { fetch: assetFetch },
    cache,
    waitUntil: (promise) => {
      pending.push(promise);
    },
  };
  return { context, cache, assetFetch, pending, kv };
};

const ITEMS_BODY = JSON.stringify({ data: [{ id: 2840, name: 'Copper Bar' }], meta: {} });

describe('routeApi', () => {
  it('maps a search to ForeverDB with a normalized query and the largest page', () => {
    expect(routeApi(new URL('https://calc.example/api/items?q=%20Copper%20BAR%20'))).toEqual({
      upstream: 'https://foreverdb.net/api/v1/items?q=copper%20bar&limit=100',
      cacheKey: 'https://calc.example/api/items?q=copper%20bar',
    });
  });

  it('rejects a query shorter than 3 letters', () => {
    expect(routeApi(new URL('https://calc.example/api/items?q=co'))).toEqual({ status: 400, message: 'q must be 3 to 80 characters' });
  });

  it('maps an item by id', () => {
    expect(routeApi(new URL('https://calc.example/api/items/2840'))).toEqual({
      upstream: 'https://foreverdb.net/api/v1/items/2840',
      cacheKey: 'https://calc.example/api/items/2840',
    });
  });

  it('answers 404 for anything else under /api', () => {
    expect(routeApi(new URL('https://calc.example/api/vendors/1'))).toEqual({ status: 404, message: 'Unknown API route' });
  });
});

describe('handleRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes non-API requests to the static assets', async () => {
    const { context, assetFetch } = createContext();
    const response = await handleRequest(new Request('https://calc.example/index.html'), context);
    expect(await response.text()).toBe('asset');
    expect(assetFetch).toHaveBeenCalledTimes(1);
  });

  it('fetches ForeverDB with the key and caches the answer for a day', async () => {
    const upstream = vi.fn(async () => new Response(ITEMS_BODY, { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const { context, cache, pending } = createContext();

    const response = await handleRequest(new Request('https://calc.example/api/items?q=copper'), context);
    await Promise.all(pending);

    expect(upstream).toHaveBeenCalledWith('https://foreverdb.net/api/v1/items?q=copper&limit=100', {
      headers: { 'X-API-Key': 'test-key', Accept: 'application/json' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
    expect(await response.text()).toBe(ITEMS_BODY);
    expect([...cache.stored.keys()]).toEqual(['https://calc.example/api/items?q=copper']);
  });

  it('answers from the cache without calling ForeverDB', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const { context, cache } = createContext();
    cache.stored.set('https://calc.example/api/items?q=copper', new Response(ITEMS_BODY));

    const response = await handleRequest(new Request('https://calc.example/api/items?q=Copper'), context);

    expect(await response.text()).toBe(ITEMS_BODY);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('turns ForeverDB errors into 502 and does not cache them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('slow down', { status: 429 })));
    const { context, cache, pending } = createContext();

    const response = await handleRequest(new Request('https://calc.example/api/items?q=copper'), context);
    await Promise.all(pending);

    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(cache.stored.size).toBe(0);
  });

  it('keeps 404 for an unknown item', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const { context } = createContext();
    const response = await handleRequest(new Request('https://calc.example/api/items/99999999'), context);
    expect(response.status).toBe(404);
  });

  it('answers 502 when ForeverDB cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('network down'))));
    const { context } = createContext();
    const response = await handleRequest(new Request('https://calc.example/api/items?q=copper'), context);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'ForeverDB could not be reached' });
  });

  it('answers 400 for a short query without calling ForeverDB', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const { context } = createContext();
    const response = await handleRequest(new Request('https://calc.example/api/items?q=a'), context);
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('only allows GET', async () => {
    const { context } = createContext();
    const response = await handleRequest(new Request('https://calc.example/api/items?q=copper', { method: 'POST' }), context);
    expect(response.status).toBe(405);
  });
});

const PRICE_LIST = JSON.stringify({
  updatedAt: '2026-11-10T16:00:00.000Z',
  house: { ruleset: 1, id: 110, name: 'Alliance Auction House' },
  prices: { '2840': 113 },
});

describe('GET /api/auction-prices', () => {
  it('serves the stored price list from KV, cacheable for an hour', async () => {
    const { context, kv, cache, pending } = createContext();
    kv.value = PRICE_LIST;
    const response = await handleRequest(new Request('https://calc.example/api/auction-prices'), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(await response.text()).toBe(PRICE_LIST);
    expect(kv.get).toHaveBeenCalledWith('auction-prices');
    await Promise.all(pending);
    expect([...cache.stored.keys()]).toEqual(['https://calc.example/api/auction-prices']);
  });

  it('answers from the edge cache without reading KV again, whatever the query string', async () => {
    const { context, kv, pending } = createContext();
    kv.value = PRICE_LIST;
    await handleRequest(new Request('https://calc.example/api/auction-prices'), context);
    await Promise.all(pending);
    const again = await handleRequest(new Request('https://calc.example/api/auction-prices?bust=1'), context);
    expect(await again.text()).toBe(PRICE_LIST);
    expect(kv.get).toHaveBeenCalledTimes(1);
  });

  it('answers 503 while nothing has been stored yet, and does not cache that', async () => {
    const { context, cache, pending } = createContext();
    const response = await handleRequest(new Request('https://calc.example/api/auction-prices'), context);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await Promise.all(pending);
    expect(cache.stored.size).toBe(0);
  });

  it('answers 502 when KV cannot be read, and does not cache that', async () => {
    const { context, kv, cache, pending } = createContext();
    kv.get.mockRejectedValueOnce(new Error('KV unavailable'));
    const response = await handleRequest(new Request('https://calc.example/api/auction-prices'), context);
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Auction prices could not be read' });
    await Promise.all(pending);
    expect(cache.stored.size).toBe(0);
  });

  it('only allows GET', async () => {
    const { context, kv } = createContext();
    const response = await handleRequest(new Request('https://calc.example/api/auction-prices', { method: 'POST' }), context);
    expect(response.status).toBe(405);
    expect(kv.get).not.toHaveBeenCalled();
  });
});

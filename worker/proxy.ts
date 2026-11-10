/**
 * /api proxy in front of ForeverDB: adds the secret key, caches answers for a day, and hands every
 * other request to the static assets. Also serves the auction price list kept in KV. Uses only standard
 * Fetch API types so tests run in Node.
 */
export type PriceStore = {
  get(key: string): Promise<string | null>;
};

export type ProxyEnv = {
  FOREVERDB_API_KEY: string;
  AUCTION_PRICES: PriceStore;
};

export type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

export type ResponseCache = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
};

export type ProxyContext = {
  env: ProxyEnv;
  assets: AssetFetcher;
  cache: ResponseCache;
  waitUntil(promise: Promise<unknown>): void;
};

export type ApiRoute = {
  upstream: string;
  cacheKey: string;
};

export type ApiError = {
  status: number;
  message: string;
};

const FOREVERDB_API = 'https://foreverdb.net/api/v1';
const CACHE_SECONDS = 86_400;
const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 80;
const SEARCH_PAGE_SIZE = 100; // ForeverDB's maximum; the app ranks and keeps 8
const ITEM_BY_ID = /^\/api\/items\/(\d{1,9})$/;
const AUCTION_PRICES_PATH = '/api/auction-prices';
const AUCTION_PRICES_KEY = 'auction-prices'; // the key .github/workflows/auction-prices.yml writes
const AUCTION_CACHE_SECONDS = 3_600;

export function routeApi(url: URL): ApiRoute | ApiError {
  if (url.pathname === '/api/items') {
    const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
      return { status: 400, message: `q must be ${MIN_QUERY_LENGTH} to ${MAX_QUERY_LENGTH} characters` };
    }
    const encoded = encodeURIComponent(query);
    return {
      upstream: `${FOREVERDB_API}/items?q=${encoded}&limit=${SEARCH_PAGE_SIZE}`,
      cacheKey: `${url.origin}/api/items?q=${encoded}`,
    };
  }
  const byId = ITEM_BY_ID.exec(url.pathname);
  if (byId !== null) {
    return { upstream: `${FOREVERDB_API}/items/${byId[1]}`, cacheKey: `${url.origin}/api/items/${byId[1]}` };
  }
  return { status: 404, message: 'Unknown API route' };
}

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Serves the price list the scheduled job stored in KV (see scripts/fetch-auction-prices.ts). */
async function handleAuctionPrices(url: URL, context: ProxyContext): Promise<Response> {
  const cacheKey = new Request(`${url.origin}${AUCTION_PRICES_PATH}`);
  const cached = await context.cache.match(cacheKey);
  if (cached !== undefined) return cached;

  const stored = await context.env.AUCTION_PRICES.get(AUCTION_PRICES_KEY);
  if (stored === null) return errorResponse(503, 'No auction prices stored yet');

  const response = new Response(stored, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${AUCTION_CACHE_SECONDS}`,
    },
  });
  context.waitUntil(context.cache.put(cacheKey, response.clone()));
  return response;
}

export async function handleRequest(request: Request, context: ProxyContext): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return context.assets.fetch(request);
  if (request.method !== 'GET') return errorResponse(405, 'Only GET is supported');
  if (url.pathname === AUCTION_PRICES_PATH) return handleAuctionPrices(url, context);

  const route = routeApi(url);
  if (!('upstream' in route)) return errorResponse(route.status, route.message);

  const cacheKey = new Request(route.cacheKey);
  const cached = await context.cache.match(cacheKey);
  if (cached !== undefined) return cached;

  let upstream: Response;
  try {
    upstream = await fetch(route.upstream, {
      headers: { 'X-API-Key': context.env.FOREVERDB_API_KEY, Accept: 'application/json' },
    });
  } catch {
    return errorResponse(502, 'ForeverDB could not be reached');
  }
  if (!upstream.ok) {
    return errorResponse(upstream.status === 404 ? 404 : 502, `ForeverDB answered ${upstream.status}`);
  }

  const response = new Response(await upstream.text(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
  context.waitUntil(context.cache.put(cacheKey, response.clone()));
  return response;
}

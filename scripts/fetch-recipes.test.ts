// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  buildCatalog,
  createApiGet,
  fetchProfession,
  fetchVendorSummaries,
  hasCooldown,
  isForeverRecipe,
  productSpellIdsOf,
  reagentIdsOf,
  retryDelayMs,
  sellsToAlliance,
  vendorPricesOf,
  type ApiRecipe,
  type ApiVendor,
  type ApiVendorLine,
  type CatalogExtras,
  type ProfessionRecipes,
} from '@scripts/fetch-recipes';

const NO_EXTRAS: CatalogExtras = { cooldowns: new Set(), vendorPrices: {} };

type FakeClock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  sleeps: number[];
};

function createClock(startMs: number): FakeClock {
  let time = startMs;
  const sleeps: number[] = [];
  const now = (): number => time;
  const sleep = async (ms: number): Promise<void> => {
    sleeps.push(ms);
    time += ms;
  };
  return { now, sleep, sleeps };
}

const apiRecipe = (overrides: Partial<ApiRecipe> = {}): ApiRecipe => ({
  spellId: 2659,
  name: 'Smelt Bronze',
  icon: 'https://foreverdb.net/icons/133227.webp',
  makes: { itemId: 2841, name: 'Bronze Bar', count: 2 },
  reagents: [
    { itemId: 2840, name: 'Copper Bar', count: 1 },
    { itemId: 3576, name: 'Tin Bar', count: 1 },
  ],
  speculation: false,
  ...overrides,
});

const mining = (...recipes: ApiRecipe[]): ProfessionRecipes => ({ profession: 'Mining', recipes });

describe('isForeverRecipe', () => {
  it('keeps a normal recipe', () => {
    expect(isForeverRecipe(apiRecipe())).toBe(true);
  });

  it('keeps a recipe that makes no item (enchant)', () => {
    expect(isForeverRecipe(apiRecipe({ makes: null }))).toBe(true);
  });

  it('drops speculation recipes', () => {
    expect(isForeverRecipe(apiRecipe({ speculation: true }))).toBe(false);
  });

  it('drops a recipe whose product is not in the Forever client', () => {
    expect(isForeverRecipe(apiRecipe({ makes: { itemId: 217285, name: null, count: 1 } }))).toBe(false);
  });

  it('drops a recipe with an unknown reagent', () => {
    expect(isForeverRecipe(apiRecipe({ reagents: [{ itemId: 1, name: null, count: 1 }] }))).toBe(false);
  });
});

describe('buildCatalog', () => {
  const icons = new Map<number, string | null>([
    [2840, 'https://foreverdb.net/icons/133216.webp'],
    [3576, null],
  ]);

  it('trims recipes to what the UI needs and records the profession', () => {
    const catalog = buildCatalog([mining(apiRecipe())], icons, '1.60.1.70862', NO_EXTRAS);
    expect(catalog).toEqual({
      build: '1.60.1.70862',
      items: {
        '2840': { name: 'Copper Bar', icon: 'https://foreverdb.net/icons/133216.webp' },
        '3576': { name: 'Tin Bar', icon: null },
      },
      vendorPrices: {},
      recipes: [
        {
          id: 2659,
          name: 'Smelt Bronze',
          profession: 'Mining',
          icon: 'https://foreverdb.net/icons/133227.webp',
          makes: { itemId: 2841, name: 'Bronze Bar', count: 2 },
          reagents: [
            { itemId: 2840, count: 1 },
            { itemId: 3576, count: 1 },
          ],
        },
      ],
    });
  });

  it('drops non-Forever recipes and their reagents', () => {
    const leftover = apiRecipe({ spellId: 1, name: 'Leftover', speculation: true, reagents: [{ itemId: 9, name: 'Odd', count: 1 }] });
    const catalog = buildCatalog([mining(apiRecipe(), leftover)], icons, 'b', NO_EXTRAS);
    expect(catalog.recipes.map((recipe) => recipe.id)).toEqual([2659]);
    expect(Object.keys(catalog.items)).toEqual(['2840', '3576']);
  });

  it('keeps the first copy of a spell listed under two professions', () => {
    const shared = apiRecipe({ spellId: 461692, name: 'Shared' });
    const catalog = buildCatalog(
      [
        { profession: 'Leatherworking', recipes: [shared] },
        { profession: 'Tailoring', recipes: [shared] },
      ],
      icons,
      'b',
      NO_EXTRAS,
    );
    expect(catalog.recipes).toHaveLength(1);
    expect(catalog.recipes[0].profession).toBe('Leatherworking');
  });

  it('sorts recipes by name, then id', () => {
    const catalog = buildCatalog(
      [mining(apiRecipe({ spellId: 3, name: 'Smelt Tin' }), apiRecipe({ spellId: 2, name: 'Smelt Copper' }))],
      icons,
      'b',
      NO_EXTRAS,
    );
    expect(catalog.recipes.map((recipe) => recipe.name)).toEqual(['Smelt Copper', 'Smelt Tin']);
  });

  it('gives an item with no fetched icon a null icon', () => {
    const catalog = buildCatalog([mining(apiRecipe())], new Map(), 'b', NO_EXTRAS);
    expect(catalog.items['2840'].icon).toBeNull();
  });
});

describe('reagentIdsOf', () => {
  it('lists unique reagent ids of the kept recipes, ascending', () => {
    const vest = apiRecipe({ spellId: 12260, name: 'Rough Copper Vest', reagents: [{ itemId: 2840, name: 'Copper Bar', count: 4 }] });
    const leftover = apiRecipe({ spellId: 1, speculation: true, reagents: [{ itemId: 9, name: 'Odd', count: 1 }] });
    expect(reagentIdsOf([mining(apiRecipe(), vest, leftover)])).toEqual([2840, 3576]);
  });
});

describe('retryDelayMs', () => {
  const now = Date.parse('2026-11-09T20:00:00Z');

  it('reads Retry-After seconds', () => {
    expect(retryDelayMs('7', now)).toBe(7_000);
  });

  it('reads a Retry-After HTTP date', () => {
    expect(retryDelayMs('Mon, 09 Nov 2026 20:00:30 GMT', now)).toBe(30_000);
  });

  it('waits a full minute when the header is missing or unreadable', () => {
    expect(retryDelayMs(null, now)).toBe(60_000);
    expect(retryDelayMs('soon', now)).toBe(60_000);
  });
});

describe('createApiGet', () => {
  it('spaces requests at least 1,100 ms apart', async () => {
    const clock = createClock(1_000_000);
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const get = createApiGet('key', { fetch: fetchFn, sleep: clock.sleep, now: clock.now });

    await get('/a');
    await get('/b');

    expect(clock.sleeps).toEqual([1_100]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('retries a 429 and honours Retry-After, then succeeds', async () => {
    const clock = createClock(1_000_000);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('slow down', { status: 429, headers: { 'Retry-After': '5' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const get = createApiGet('key', { fetch: fetchFn, sleep: clock.sleep, now: clock.now });

    const result = await get('/api/v1/items?q=copper');

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(clock.sleeps).toEqual([5_000]);
  });

  it('retries a 5xx response and gives up after 5 attempts', async () => {
    const clock = createClock(1_000_000);
    const fetchFn = vi.fn(async () => new Response('oops', { status: 503 }));
    const get = createApiGet('key', { fetch: fetchFn, sleep: clock.sleep, now: clock.now });

    await expect(get('/api/v1/professions')).rejects.toThrow(/5 attempts/);
    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(clock.sleeps).toEqual([2_000, 4_000, 8_000, 16_000]);
  });

  it('retries a network error (fetch rejecting) and gives up after 5 attempts', async () => {
    const clock = createClock(1_000_000);
    const fetchFn = vi.fn(async () => {
      throw new TypeError('network down');
    });
    const get = createApiGet('key', { fetch: fetchFn, sleep: clock.sleep, now: clock.now });

    await expect(get('/api/v1/professions')).rejects.toThrow(/5 attempts/);
    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(clock.sleeps).toEqual([2_000, 4_000, 8_000, 16_000]);
  });

  it('recovers from a network error once a later attempt succeeds', async () => {
    const clock = createClock(1_000_000);
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const get = createApiGet('key', { fetch: fetchFn, sleep: clock.sleep, now: clock.now });

    const result = await get('/api/v1/professions');

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(clock.sleeps).toEqual([2_000]);
  });

  it('resolves null for a 404 on an item lookup', async () => {
    const clock = createClock(1_000_000);
    const fetchFn = vi.fn(async () => new Response('{}', { status: 404 }));
    const get = createApiGet('key', { fetch: fetchFn, sleep: clock.sleep, now: clock.now });

    expect(await get('/api/v1/items/99999999')).toBeNull();
  });

  it('resolves null for a 404 on a spell lookup', async () => {
    const clock = createClock(1_000_000);
    const fetchFn = vi.fn(async () => new Response('{}', { status: 404 }));
    const get = createApiGet('key', { fetch: fetchFn, sleep: clock.sleep, now: clock.now });

    expect(await get('/api/v1/spells/1')).toBeNull();
  });

  it('resolves null for a 404 on a vendor lookup', async () => {
    const clock = createClock(1_000_000);
    const fetchFn = vi.fn(async () => new Response('{}', { status: 404 }));
    const get = createApiGet('key', { fetch: fetchFn, sleep: clock.sleep, now: clock.now });

    expect(await get('/api/v1/vendors/1')).toBeNull();
  });

  it('throws a clear error on a 404 for a non-item path', async () => {
    const clock = createClock(1_000_000);
    const fetchFn = vi.fn(async () => new Response('{}', { status: 404 }));
    const get = createApiGet('key', { fetch: fetchFn, sleep: clock.sleep, now: clock.now });

    await expect(get('/api/v1/professions/mining')).rejects.toThrow('/api/v1/professions/mining');
  });
});

describe('fetchProfession', () => {
  const profession = { slug: 'mining', name: 'Mining' };

  it('stops when meta.next is missing', async () => {
    const get = vi.fn(async () => ({
      data: { recipes: [apiRecipe()] },
      meta: { build: 'b', next: null },
    }));

    const result = await fetchProfession(get, profession);

    expect(result).toEqual({ recipes: [apiRecipe()], build: 'b' });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('follows meta.next until it runs out', async () => {
    const page1 = {
      data: { recipes: [apiRecipe({ spellId: 1 })] },
      meta: { build: 'b', next: '/api/v1/professions/mining?limit=100&offset=100' },
    };
    const page2 = { data: { recipes: [apiRecipe({ spellId: 2 })] }, meta: { build: 'b' } };
    const get = vi.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const result = await fetchProfession(get, profession);

    expect(result.recipes.map((recipe) => recipe.spellId)).toEqual([1, 2]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('throws when a next path repeats, instead of looping forever', async () => {
    const loopingPath = '/api/v1/professions/mining?limit=100&offset=100';
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: { recipes: [] }, meta: { build: 'b', next: loopingPath } })
      .mockResolvedValueOnce({ data: { recipes: [] }, meta: { build: 'b', next: loopingPath } });

    await expect(fetchProfession(get, profession)).rejects.toThrow(/repeated/);
  });
});

describe('sellsToAlliance', () => {
  it('accepts Alliance and neutral vendors, in any case', () => {
    expect(sellsToAlliance('Alliance')).toBe(true);
    expect(sellsToAlliance('both')).toBe(true);
    expect(sellsToAlliance('Both')).toBe(true);
    expect(sellsToAlliance('Horde')).toBe(false);
  });

  it('accepts a vendor whose side is missing (the summaries were already filtered by side)', () => {
    expect(sellsToAlliance(undefined)).toBe(true);
  });
});

describe('vendorPricesOf', () => {
  const line = (itemId: number, pricePerItem: number, extra: Partial<ApiVendorLine> = {}) => ({
    itemId,
    price: pricePerItem,
    stack: 1,
    pricePerItem,
    limited: false,
    ...extra,
  });
  const vendor = (side: string, sells: ApiVendorLine[]): ApiVendor => ({ side, sells });

  it('keeps the cheapest price per wanted item across Alliance and neutral vendors', () => {
    const vendors = [vendor('Alliance', [line(2320, 10), line(1, 5)]), vendor('both', [line(2320, 8)])];
    expect(vendorPricesOf(vendors, new Set([2320]))).toEqual({ '2320': 8 });
  });

  it('ignores Horde vendors, limited stock, non-gold costs and free lines', () => {
    const vendors = [
      vendor('Horde', [line(2320, 1)]),
      vendor('Alliance', [line(2320, 2, { limited: true }), line(2320, 3, { costs: [{ name: "Merchant's Favor" }] }), line(2320, 0)]),
      vendor('Alliance', [line(2320, 9)]),
    ];
    expect(vendorPricesOf(vendors, new Set([2320]))).toEqual({ '2320': 9 });
  });

  it('rounds a stack share to whole copper, never below 1', () => {
    const vendors = [vendor('Alliance', [line(3371, 0.2, { price: 1, stack: 5 }), line(4289, 12.6, { price: 63, stack: 5 })])];
    expect(vendorPricesOf(vendors, new Set([3371, 4289]))).toEqual({ '3371': 1, '4289': 13 });
  });

  it('treats a vendor without stock as selling nothing', () => {
    const vendors: ApiVendor[] = [{ side: 'Alliance' }, vendor('Alliance', [line(2320, 9)])];
    expect(vendorPricesOf(vendors, new Set([2320]))).toEqual({ '2320': 9 });
  });

  it('counts a vendor without a side', () => {
    expect(vendorPricesOf([{ sells: [line(2320, 9)] }], new Set([2320]))).toEqual({ '2320': 9 });
  });

  it('falls back to price / stack when pricePerItem is not a number, else skips the line', () => {
    const vendors = [
      vendor('Alliance', [
        line(2320, Number.NaN, { price: 50, stack: 5 }),
        line(2321, Number.NaN, { price: 50, stack: 0 }),
        { itemId: 2678, price: 40, stack: 2, limited: false },
        { itemId: 2692, price: Number.POSITIVE_INFINITY, stack: 1, limited: false },
      ]),
    ];
    expect(vendorPricesOf(vendors, new Set([2320, 2321, 2678, 2692]))).toEqual({ '2320': 10, '2678': 20 });
  });

  it('treats a line as gold-only only when costs is missing or an empty list', () => {
    const vendors = [
      vendor('Alliance', [
        line(2320, 3, { costs: [] }),
        line(2321, 3, { costs: { name: "Merchant's Favor" } }),
        line(2322, 3, { costs: null }),
      ]),
    ];
    expect(vendorPricesOf(vendors, new Set([2320, 2321, 2322]))).toEqual({ '2320': 3 });
  });
});

describe('hasCooldown', () => {
  it('reads a positive cooldown', () => {
    expect(hasCooldown({ data: { cooldownMs: 342_000_000 } })).toBe(true);
  });

  it('counts a missing spell, missing data or a null or zero cooldown as none', () => {
    expect(hasCooldown(null)).toBe(false);
    expect(hasCooldown({})).toBe(false);
    expect(hasCooldown({ data: {} })).toBe(false);
    expect(hasCooldown({ data: { cooldownMs: null } })).toBe(false);
    expect(hasCooldown({ data: { cooldownMs: 0 } })).toBe(false);
  });
});

describe('productSpellIdsOf', () => {
  it('lists the kept recipes that make an item', () => {
    const enchant = apiRecipe({ spellId: 7418, name: 'Enchant', makes: null });
    const leftover = apiRecipe({ spellId: 1, speculation: true });
    expect(productSpellIdsOf([mining(apiRecipe(), enchant, leftover)])).toEqual([2659]);
  });
});

describe('fetchVendorSummaries', () => {
  it('follows meta.next until it runs out', async () => {
    const pages: Record<string, unknown> = {
      '/api/v1/vendors?limit=100&offset=0': { data: [{ id: 1, side: 'Alliance' }], meta: { next: '/api/v1/vendors?limit=100&offset=100' } },
      '/api/v1/vendors?limit=100&offset=100': { data: [{ id: 2, side: 'Horde' }], meta: { next: null } },
    };
    const get = vi.fn(async (path: string) => pages[path]);
    expect(await fetchVendorSummaries(get)).toEqual([
      { id: 1, side: 'Alliance' },
      { id: 2, side: 'Horde' },
    ]);
  });

  it('stops on a pagination loop', async () => {
    const get = vi.fn(async () => ({ data: [], meta: { next: '/api/v1/vendors?limit=100&offset=0' } }));
    await expect(fetchVendorSummaries(get)).rejects.toThrow('Pagination loop');
  });
});

describe('buildCatalog extras', () => {
  it('marks cooldown recipes and adds the vendor prices', () => {
    const extras: CatalogExtras = { cooldowns: new Set([2659]), vendorPrices: { '3576': 200 } };
    const catalog = buildCatalog([mining(apiRecipe())], new Map(), 'b', extras);
    expect(catalog.recipes[0].cooldown).toBe(true);
    expect(catalog.vendorPrices).toEqual({ '3576': 200 });
  });

  it('leaves the cooldown field out when there is none', () => {
    const catalog = buildCatalog([mining(apiRecipe())], new Map(), 'b', NO_EXTRAS);
    expect(catalog.recipes[0]).not.toHaveProperty('cooldown');
  });
});

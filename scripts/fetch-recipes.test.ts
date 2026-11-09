// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  buildCatalog,
  createApiGet,
  fetchProfession,
  isForeverRecipe,
  reagentIdsOf,
  retryDelayMs,
  type ApiRecipe,
  type ProfessionRecipes,
} from '@scripts/fetch-recipes';

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
    const catalog = buildCatalog([mining(apiRecipe())], icons, '1.60.1.70862');
    expect(catalog).toEqual({
      build: '1.60.1.70862',
      items: {
        '2840': { name: 'Copper Bar', icon: 'https://foreverdb.net/icons/133216.webp' },
        '3576': { name: 'Tin Bar', icon: null },
      },
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
    const catalog = buildCatalog([mining(apiRecipe(), leftover)], icons, 'b');
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
    );
    expect(catalog.recipes).toHaveLength(1);
    expect(catalog.recipes[0].profession).toBe('Leatherworking');
  });

  it('sorts recipes by name, then id', () => {
    const catalog = buildCatalog(
      [mining(apiRecipe({ spellId: 3, name: 'Smelt Tin' }), apiRecipe({ spellId: 2, name: 'Smelt Copper' }))],
      icons,
      'b',
    );
    expect(catalog.recipes.map((recipe) => recipe.name)).toEqual(['Smelt Copper', 'Smelt Tin']);
  });

  it('gives an item with no fetched icon a null icon', () => {
    const catalog = buildCatalog([mining(apiRecipe())], new Map(), 'b');
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

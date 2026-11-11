/**
 * Downloads every profession's recipes from ForeverDB, keeps the ones that exist in the Forever client,
 * looks up each reagent's icon, and writes src/data/recipes.json.
 *
 * Run with `npm run fetch:recipes` (reads FOREVERDB_API_KEY from .env). Takes about an hour: besides the
 * recipes and reagent icons it reads every crafted recipe's spell (for its cooldown) and every Alliance or
 * neutral vendor's stock (for vendor prices), and ForeverDB allows 60 requests a minute per key, shared with
 * the live site's item search.
 *
 * Only type imports from src/ (erased when Node strips types), so Node runs this file directly.
 */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { CatalogItem, CatalogRecipe, RecipeCatalog } from '@/recipes/catalog';

export type ApiReagent = {
  itemId: number;
  name: string | null;
  count: number;
};

export type ApiProduct = {
  itemId: number;
  name: string | null;
  count: number;
};

export type ApiRecipe = {
  spellId: number;
  name: string;
  icon: string;
  makes: ApiProduct | null;
  reagents: ApiReagent[];
  speculation: boolean;
};

export type ProfessionRecipes = {
  profession: string;
  recipes: ApiRecipe[];
};

type ApiProfession = {
  slug: string;
  name: string;
};

type ApiProfessionList = {
  data: ApiProfession[];
};

type ApiProfessionPage = {
  data: { recipes: ApiRecipe[] };
  meta: { build: string; next?: string | null };
};

type ApiItem = {
  data: { id: number; icon: string };
};

export type ApiVendorSummary = {
  id: number;
  side: string;
};

type ApiVendorPage = {
  data: ApiVendorSummary[];
  meta: { next?: string | null };
};

export type ApiVendorLine = {
  itemId: number;
  /** Copper for one purchase of `stack` items. */
  price: number;
  stack: number;
  /** One item's share of `price`; may be fractional, and may be missing. */
  pricePerItem?: number;
  limited: boolean;
  /** A non-empty list when the vendor asks for something besides gold (Merchant's Favor, items). */
  costs?: unknown;
};

/** side and sells may be missing on an odd record; the run must not crash on one. */
export type ApiVendor = {
  side?: string;
  sells?: ApiVendorLine[];
};

type ApiVendorAnswer = {
  data?: ApiVendor;
};

export type ApiSpell = {
  data?: { cooldownMs?: number | null };
};

/** What buildCatalog adds besides the recipes and icons. */
export type CatalogExtras = {
  /** Spell ids of recipes with a cooldown. */
  cooldowns: Set<number>;
  vendorPrices: Record<string, number>;
};

export type ApiGet = (path: string) => Promise<unknown>;

export type ApiGetDeps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

const API_ORIGIN = 'https://foreverdb.net';
const OUTPUT_FILE = resolve('src/data/recipes.json');
const REQUEST_INTERVAL_MS = 1_100; // about 54 a minute, under ForeverDB's 60/min
const MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_MS = 60_000;
const MAX_PAGES = 50;
// Backoff for network errors and 5xx responses; 429 keeps its own Retry-After-driven delay.
const RETRY_BACKOFF_MS: number[] = [2_000, 4_000, 8_000, 16_000];
// A lookup by id that may legitimately be missing: an item without data, a spell or vendor ForeverDB dropped.
const NULLABLE_PATH = /^\/api\/v1\/(?:items|spells|vendors)\/\d+$/;

export function isForeverRecipe(recipe: ApiRecipe): boolean {
  if (recipe.speculation) return false;
  // A product or reagent without a name is not in the Forever client (Season of Discovery leftovers).
  if (recipe.makes !== null && recipe.makes.name === null) return false;
  return recipe.reagents.every((reagent) => reagent.name !== null);
}

function toCatalogRecipe(recipe: ApiRecipe, profession: string, cooldown: boolean): CatalogRecipe {
  const catalogRecipe: CatalogRecipe = {
    id: recipe.spellId,
    name: recipe.name,
    profession,
    icon: recipe.icon,
    makes:
      recipe.makes === null
        ? null
        : { itemId: recipe.makes.itemId, name: recipe.makes.name ?? recipe.name, count: recipe.makes.count },
    reagents: recipe.reagents.map((reagent) => ({ itemId: reagent.itemId, count: reagent.count })),
  };
  if (cooldown) catalogRecipe.cooldown = true;
  return catalogRecipe;
}

export function buildCatalog(
  professions: ProfessionRecipes[],
  icons: Map<number, string | null>,
  build: string,
  extras: CatalogExtras,
): RecipeCatalog {
  const recipes: CatalogRecipe[] = [];
  const items: Record<string, CatalogItem> = {};
  const seenSpells = new Set<number>();
  for (const { profession, recipes: apiRecipes } of professions) {
    for (const recipe of apiRecipes) {
      if (seenSpells.has(recipe.spellId) || !isForeverRecipe(recipe)) continue;
      seenSpells.add(recipe.spellId);
      recipes.push(toCatalogRecipe(recipe, profession, extras.cooldowns.has(recipe.spellId)));
      for (const reagent of recipe.reagents) {
        items[String(reagent.itemId)] = { name: reagent.name ?? '', icon: icons.get(reagent.itemId) ?? null };
      }
    }
  }
  recipes.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id - b.id);
  // Integer-like keys always iterate in ascending order, so the JSON is stable between runs.
  return { build, items, vendorPrices: extras.vendorPrices, recipes };
}

const NO_EXTRAS: CatalogExtras = { cooldowns: new Set(), vendorPrices: {} };

export function reagentIdsOf(professions: ProfessionRecipes[]): number[] {
  return Object.keys(buildCatalog(professions, new Map(), '', NO_EXTRAS).items).map(Number);
}

/** Recipes that make an item: only those can be sold, so only their cooldown matters. */
export function productSpellIdsOf(professions: ProfessionRecipes[]): number[] {
  return buildCatalog(professions, new Map(), '', NO_EXTRAS)
    .recipes.filter((recipe) => recipe.makes !== null)
    .map((recipe) => recipe.id);
}

/** A missing side counts as selling: vendor summaries are filtered by side before their details are read. */
export function sellsToAlliance(side: string | undefined): boolean {
  if (typeof side !== 'string') return true;
  const normalized = side.toLowerCase();
  return normalized === 'alliance' || normalized === 'both';
}

/** A missing spell, a missing data block or a null cooldown all count as no cooldown. */
export function hasCooldown(spell: ApiSpell | null): boolean {
  return (spell?.data?.cooldownMs ?? 0) > 0;
}

function isGoldOnly(line: ApiVendorLine): boolean {
  return Array.isArray(line.costs) ? line.costs.length === 0 : line.costs === undefined;
}

/** One item's copper, from pricePerItem or else price / stack; null when neither is a finite number. */
function pricePerItemOf(line: ApiVendorLine): number | null {
  if (line.pricePerItem !== undefined && Number.isFinite(line.pricePerItem)) return line.pricePerItem;
  if (Number.isFinite(line.price) && Number.isFinite(line.stack) && line.stack > 0) return line.price / line.stack;
  return null;
}

/** Cheapest copper per wanted item over gold-only, unlimited lines of Alliance and neutral vendors. */
export function vendorPricesOf(vendors: ApiVendor[], wanted: Set<number>): Record<string, number> {
  const cheapest = new Map<number, number>();
  for (const vendor of vendors) {
    if (!sellsToAlliance(vendor.side)) continue;
    for (const line of vendor.sells ?? []) {
      if (!wanted.has(line.itemId) || line.limited || !isGoldOnly(line) || !(line.price > 0)) continue;
      const perItem = pricePerItemOf(line);
      if (perItem === null) continue;
      const copper = Math.max(1, Math.round(perItem));
      const known = cheapest.get(line.itemId);
      if (known === undefined || copper < known) cheapest.set(line.itemId, copper);
    }
  }
  // Integer-like keys iterate ascending, so the JSON stays stable between runs.
  return Object.fromEntries([...cheapest].map(([itemId, copper]) => [String(itemId), copper]));
}

export async function fetchVendorSummaries(get: ApiGet): Promise<ApiVendorSummary[]> {
  const vendors: ApiVendorSummary[] = [];
  let next: string | null = '/api/v1/vendors?limit=100&offset=0';
  const seenPaths = new Set<string>();
  while (next !== null) {
    if (seenPaths.has(next)) throw new Error(`Pagination loop detected while fetching vendors: ${next} repeated`);
    seenPaths.add(next);
    if (seenPaths.size > MAX_PAGES) throw new Error(`Exceeded ${MAX_PAGES} pages while fetching vendors`);
    const page = (await get(next)) as ApiVendorPage;
    vendors.push(...page.data.map((vendor) => ({ id: vendor.id, side: vendor.side })));
    next = page.meta.next ?? null;
  }
  return vendors;
}

export function retryDelayMs(retryAfter: string | null, now: number): number {
  if (retryAfter === null) return DEFAULT_RETRY_MS;
  const seconds = Number(retryAfter);
  if (retryAfter.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? DEFAULT_RETRY_MS : Math.max(date - now, 0);
}

/**
 * GET helper that spaces requests out, retries 429s (honouring Retry-After), network errors and 5xx
 * responses (fixed backoff), and resolves null on 404 only for a lookup by id (item, spell, vendor);
 * any other 404 throws.
 */
export function createApiGet(apiKey: string, deps: ApiGetDeps): ApiGet {
  let lastRequestAt = 0;
  return async (path) => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const wait = lastRequestAt + REQUEST_INTERVAL_MS - deps.now();
      if (wait > 0) await deps.sleep(wait);
      lastRequestAt = deps.now();

      let response: Response;
      try {
        response = await deps.fetch(`${API_ORIGIN}${path}`, {
          headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
        });
      } catch (error) {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(`GET ${path} failed after ${MAX_ATTEMPTS} attempts: ${(error as Error).message}`);
        }
        const delay = RETRY_BACKOFF_MS[attempt - 1];
        console.warn(
          `Network error on ${path} (${(error as Error).message}); retrying in ${delay / 1_000} s (attempt ${attempt}/${MAX_ATTEMPTS})`,
        );
        await deps.sleep(delay);
        continue;
      }

      if (response.status === 429) {
        if (attempt === MAX_ATTEMPTS) throw new Error(`GET ${path} was still rate limited after ${MAX_ATTEMPTS} attempts`);
        const delay = retryDelayMs(response.headers.get('Retry-After'), deps.now());
        console.warn(`Rate limited on ${path}; waiting ${Math.ceil(delay / 1_000)} s (attempt ${attempt}/${MAX_ATTEMPTS})`);
        await deps.sleep(delay);
        continue;
      }

      if (response.status >= 500) {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(`GET ${path} failed after ${MAX_ATTEMPTS} attempts with HTTP ${response.status}`);
        }
        const delay = RETRY_BACKOFF_MS[attempt - 1];
        console.warn(`Server error ${response.status} on ${path}; retrying in ${delay / 1_000} s (attempt ${attempt}/${MAX_ATTEMPTS})`);
        await deps.sleep(delay);
        continue;
      }

      if (response.status === 404) {
        if (NULLABLE_PATH.test(path)) return null;
        throw new Error(`GET ${path} returned 404`);
      }

      if (!response.ok) throw new Error(`GET ${path} failed with HTTP ${response.status}`);
      return response.json();
    }
    throw new Error(`GET ${path} exhausted ${MAX_ATTEMPTS} attempts`);
  };
}

export async function fetchProfession(get: ApiGet, profession: ApiProfession): Promise<{ recipes: ApiRecipe[]; build: string }> {
  const recipes: ApiRecipe[] = [];
  let build = '';
  let next: string | null = `/api/v1/professions/${profession.slug}?limit=100&offset=0`;
  const seenPaths = new Set<string>();
  let pageCount = 0;
  while (next !== null) {
    if (seenPaths.has(next)) throw new Error(`Pagination loop detected while fetching ${profession.slug}: ${next} repeated`);
    seenPaths.add(next);
    pageCount += 1;
    if (pageCount > MAX_PAGES) throw new Error(`Exceeded ${MAX_PAGES} pages while fetching ${profession.slug}`);

    const page = (await get(next)) as ApiProfessionPage;
    recipes.push(...page.data.recipes);
    if (build !== '' && page.meta.build !== build) {
      console.warn(`${profession.name} pages report different builds: ${build} vs ${page.meta.build}`);
    }
    build = page.meta.build;
    next = page.meta.next ?? null;
  }
  return { recipes, build };
}

async function writeCatalog(catalog: RecipeCatalog): Promise<void> {
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  const tmpFile = `${OUTPUT_FILE}.tmp`;
  await writeFile(tmpFile, `${JSON.stringify(catalog, null, 2)}\n`);
  await rename(tmpFile, OUTPUT_FILE);
}

async function main(): Promise<void> {
  const apiKey = process.env.FOREVERDB_API_KEY?.trim() ?? '';
  if (apiKey === '') {
    console.error('FOREVERDB_API_KEY is missing. Copy .env.example to .env and put your ForeverDB key in it.');
    process.exit(1);
  }
  const get = createApiGet(apiKey, { fetch, sleep, now: Date.now });

  const list = (await get('/api/v1/professions')) as ApiProfessionList;
  const professions: ProfessionRecipes[] = [];
  let build = '';
  for (const profession of list.data) {
    const fetched = await fetchProfession(get, profession);
    if (build !== '' && fetched.build !== build) {
      console.warn(`${profession.name} reports build ${fetched.build}, expected ${build}`);
    }
    build = fetched.build;
    professions.push({ profession: profession.name, recipes: fetched.recipes });
    console.log(`${profession.name}: ${fetched.recipes.length} recipes`);
  }

  const reagentIds = reagentIdsOf(professions);
  const minutes = Math.ceil((reagentIds.length * REQUEST_INTERVAL_MS) / 60_000);
  console.log(`Fetching icons for ${reagentIds.length} reagents (about ${minutes} min)…`);
  const icons = new Map<number, string | null>();
  for (const [index, itemId] of reagentIds.entries()) {
    const item = (await get(`/api/v1/items/${itemId}`)) as ApiItem | null;
    icons.set(itemId, item === null ? null : item.data.icon);
    if ((index + 1) % 50 === 0) console.log(`  ${index + 1}/${reagentIds.length}`);
  }

  const spellIds = productSpellIdsOf(professions);
  console.log(`Checking ${spellIds.length} crafted recipes for cooldowns (about ${Math.ceil((spellIds.length * REQUEST_INTERVAL_MS) / 60_000)} min)…`);
  const cooldowns = new Set<number>();
  for (const [index, spellId] of spellIds.entries()) {
    const spell = (await get(`/api/v1/spells/${spellId}`)) as ApiSpell | null;
    if (hasCooldown(spell)) cooldowns.add(spellId);
    if ((index + 1) % 100 === 0) console.log(`  ${index + 1}/${spellIds.length}`);
  }

  const summaries = (await fetchVendorSummaries(get)).filter((vendor) => sellsToAlliance(vendor.side));
  console.log(`Reading ${summaries.length} vendors (about ${Math.ceil((summaries.length * REQUEST_INTERVAL_MS) / 60_000)} min)…`);
  const vendors: ApiVendor[] = [];
  for (const [index, summary] of summaries.entries()) {
    const answer = (await get(`/api/v1/vendors/${summary.id}`)) as ApiVendorAnswer | null;
    if (answer?.data !== undefined) vendors.push(answer.data);
    if ((index + 1) % 100 === 0) console.log(`  ${index + 1}/${summaries.length}`);
  }
  const vendorPrices = vendorPricesOf(vendors, new Set(reagentIds));

  const catalog = buildCatalog(professions, icons, build, { cooldowns, vendorPrices });
  await writeCatalog(catalog);
  const missingIcons = Object.values(catalog.items).filter((item) => item.icon === null).length;
  console.log(
    `Wrote ${catalog.recipes.length} recipes and ${Object.keys(catalog.items).length} reagents ` +
      `(${missingIcons} without icon, build ${catalog.build}, ${cooldowns.size} with a cooldown, ` +
      `${Object.keys(vendorPrices).length} vendor prices) to ${OUTPUT_FILE}`,
  );
}

const runAsScript = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runAsScript) await main();

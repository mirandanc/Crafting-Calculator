/**
 * Downloads every profession's recipes from ForeverDB, keeps the ones that exist in the Forever client,
 * looks up each reagent's icon, and writes src/data/recipes.json.
 *
 * Run with `npm run fetch:recipes` (reads FOREVERDB_API_KEY from .env). Takes about 10 minutes:
 * ForeverDB allows 60 requests a minute per key, shared with the live site's item search.
 *
 * Only type imports from src/ (erased when Node strips types), so Node runs this file directly.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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

type ApiGet = (path: string) => Promise<unknown>;

const API_ORIGIN = 'https://foreverdb.net';
const OUTPUT_FILE = resolve('src/data/recipes.json');
const REQUEST_INTERVAL_MS = 1_100; // about 54 a minute, under ForeverDB's 60/min
const MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_MS = 60_000;

export function isForeverRecipe(recipe: ApiRecipe): boolean {
  if (recipe.speculation) return false;
  // A product or reagent without a name is not in the Forever client (Season of Discovery leftovers).
  if (recipe.makes !== null && recipe.makes.name === null) return false;
  return recipe.reagents.every((reagent) => reagent.name !== null);
}

function toCatalogRecipe(recipe: ApiRecipe, profession: string): CatalogRecipe {
  return {
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
}

export function buildCatalog(
  professions: ProfessionRecipes[],
  icons: Map<number, string | null>,
  build: string,
): RecipeCatalog {
  const recipes: CatalogRecipe[] = [];
  const items: Record<string, CatalogItem> = {};
  const seenSpells = new Set<number>();
  for (const { profession, recipes: apiRecipes } of professions) {
    for (const recipe of apiRecipes) {
      if (seenSpells.has(recipe.spellId) || !isForeverRecipe(recipe)) continue;
      seenSpells.add(recipe.spellId);
      recipes.push(toCatalogRecipe(recipe, profession));
      for (const reagent of recipe.reagents) {
        items[String(reagent.itemId)] = { name: reagent.name ?? '', icon: icons.get(reagent.itemId) ?? null };
      }
    }
  }
  recipes.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id - b.id);
  // Integer-like keys always iterate in ascending order, so the JSON is stable between runs.
  return { build, items, recipes };
}

export function reagentIdsOf(professions: ProfessionRecipes[]): number[] {
  return Object.keys(buildCatalog(professions, new Map(), '').items).map(Number);
}

export function retryDelayMs(retryAfter: string | null, now: number): number {
  if (retryAfter === null) return DEFAULT_RETRY_MS;
  const seconds = Number(retryAfter);
  if (retryAfter.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? DEFAULT_RETRY_MS : Math.max(date - now, 0);
}

/** GET helper that spaces requests out and waits out 429s; resolves null on 404. */
function createApiGet(apiKey: string): ApiGet {
  let lastRequestAt = 0;
  return async (path) => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const wait = lastRequestAt + REQUEST_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastRequestAt = Date.now();
      const response = await fetch(`${API_ORIGIN}${path}`, {
        headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      });
      if (response.status === 429) {
        const delay = retryDelayMs(response.headers.get('Retry-After'), Date.now());
        console.warn(`Rate limited on ${path}; waiting ${Math.ceil(delay / 1_000)} s (attempt ${attempt}/${MAX_ATTEMPTS})`);
        await sleep(delay);
        continue;
      }
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`GET ${path} failed with HTTP ${response.status}`);
      return response.json();
    }
    throw new Error(`GET ${path} was still rate limited after ${MAX_ATTEMPTS} attempts`);
  };
}

async function fetchProfession(get: ApiGet, profession: ApiProfession): Promise<{ recipes: ApiRecipe[]; build: string }> {
  const recipes: ApiRecipe[] = [];
  let build = '';
  let next: string | null = `/api/v1/professions/${profession.slug}?limit=100&offset=0`;
  while (next !== null) {
    const page = (await get(next)) as ApiProfessionPage;
    recipes.push(...page.data.recipes);
    build = page.meta.build;
    next = page.meta.next ?? null;
  }
  return { recipes, build };
}

async function main(): Promise<void> {
  const apiKey = process.env.FOREVERDB_API_KEY?.trim() ?? '';
  if (apiKey === '') {
    console.error('FOREVERDB_API_KEY is missing. Copy .env.example to .env and put your ForeverDB key in it.');
    process.exit(1);
  }
  const get = createApiGet(apiKey);

  const list = (await get('/api/v1/professions')) as ApiProfessionList;
  const professions: ProfessionRecipes[] = [];
  let build = '';
  for (const profession of list.data) {
    const fetched = await fetchProfession(get, profession);
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

  const catalog = buildCatalog(professions, icons, build);
  await writeFile(OUTPUT_FILE, `${JSON.stringify(catalog)}\n`);
  const missingIcons = Object.values(catalog.items).filter((item) => item.icon === null).length;
  console.log(
    `Wrote ${catalog.recipes.length} recipes and ${Object.keys(catalog.items).length} reagents ` +
      `(${missingIcons} without icon, build ${catalog.build}) to ${OUTPUT_FILE}`,
  );
}

const runAsScript = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runAsScript) await main();

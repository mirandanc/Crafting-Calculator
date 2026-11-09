import { normalizeCoins } from '@/money/money';
import type { CatalogProduct } from '@/recipes/catalog';
import {
  parseQuantity,
  parseWanted,
  type Entry,
  type ItemRow,
  type PickedRecipe,
  type Prices,
  type ReagentLine,
  type RecipeBlock,
  type Sheet,
} from '@/sheet/sheet';

type SavedSheet = Sheet & { version: 2 };

type UnknownRecord = Record<string, unknown>;

export const STORAGE_KEY = 'crafting-calculator:v2';

/** Older formats are dropped on load, not migrated. */
const LEGACY_STORAGE_KEYS: string[] = ['crafting-calculator:v1'];

const PRICE_KEY = /^(id:\d+|name:.*)$/;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** null stays null, a value passing the guard is returned, anything else is undefined (invalid). */
function readNullable<T>(value: unknown, guard: (candidate: unknown) => candidate is T): T | null | undefined {
  if (value === null) return null;
  return guard(value) ? value : undefined;
}

function parseReagent(value: unknown): ReagentLine | null {
  if (!isRecord(value)) return null;
  const icon = readNullable(value.icon, isString);
  if (!isPositiveInteger(value.itemId) || !isString(value.name) || icon === undefined || !isPositiveInteger(value.perCraft)) {
    return null;
  }
  return { itemId: value.itemId, name: value.name, icon, perCraft: value.perCraft };
}

function parseProduct(value: unknown): CatalogProduct | null {
  if (!isRecord(value) || !isPositiveInteger(value.itemId) || !isString(value.name) || !isPositiveInteger(value.count)) {
    return null;
  }
  return { itemId: value.itemId, name: value.name, count: value.count };
}

function parsePickedRecipe(value: unknown): PickedRecipe | null {
  if (!isRecord(value)) return null;
  if (
    !isPositiveInteger(value.spellId) ||
    !isString(value.name) ||
    !isString(value.profession) ||
    !isString(value.icon) ||
    !Array.isArray(value.reagents)
  ) {
    return null;
  }
  const makes = value.makes === null ? null : parseProduct(value.makes);
  if (value.makes !== null && makes === null) return null;
  const reagents = value.reagents
    .map((reagent: unknown) => parseReagent(reagent))
    .filter((reagent): reagent is ReagentLine => reagent !== null);
  return { spellId: value.spellId, name: value.name, profession: value.profession, icon: value.icon, makes, reagents };
}

function parseRecipeBlock(value: UnknownRecord, id: string): RecipeBlock | null {
  const recipe = value.recipe === null ? null : parsePickedRecipe(value.recipe);
  if (value.recipe !== null && recipe === null) return null;
  const wanted = readNullable(value.wanted, isFiniteNumber);
  if (wanted === undefined) return null;
  return { kind: 'recipe', id, recipe, wanted: wanted === null ? null : parseWanted(String(wanted)) };
}

function parseItemRow(value: UnknownRecord, id: string): ItemRow | null {
  const itemId = readNullable(value.itemId, isPositiveInteger);
  const icon = readNullable(value.icon, isString);
  const quantity = readNullable(value.quantity, isFiniteNumber);
  if (!isString(value.name) || itemId === undefined || icon === undefined || quantity === undefined) return null;
  return {
    kind: 'item',
    id,
    name: value.name,
    itemId,
    icon,
    quantity: quantity === null ? null : parseQuantity(String(quantity)),
  };
}

function parseEntry(value: unknown): Entry | null {
  if (!isRecord(value) || !isString(value.id)) return null;
  if (value.kind === 'recipe') return parseRecipeBlock(value, value.id);
  if (value.kind === 'item') return parseItemRow(value, value.id);
  return null;
}

function parseEntries(value: unknown): Entry[] | null {
  if (!Array.isArray(value)) return null;
  const seenIds = new Set<string>();
  const entries: Entry[] = [];
  for (const raw of value) {
    const entry = parseEntry(raw);
    if (entry === null || seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    entries.push(entry);
  }
  return entries.length === 0 ? null : entries;
}

function parsePrices(value: unknown): Prices {
  const prices: Prices = {};
  if (!isRecord(value)) return prices;
  for (const [key, raw] of Object.entries(value)) {
    if (!PRICE_KEY.test(key) || !isRecord(raw)) continue;
    prices[key] = normalizeCoins({
      gold: isFiniteNumber(raw.gold) ? raw.gold : 0,
      silver: isFiniteNumber(raw.silver) ? raw.silver : 0,
      copper: isFiniteNumber(raw.copper) ? raw.copper : 0,
    });
  }
  return prices;
}

export function loadSheet(): Sheet | null {
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved) || saved.version !== 2) return null;
    const entries = parseEntries(saved.entries);
    if (entries === null) return null;
    return { entries, prices: parsePrices(saved.prices), muted: saved.muted === true };
  } catch {
    return null;
  }
}

export function saveSheet(sheet: Sheet): void {
  try {
    const saved: SavedSheet = { ...sheet, version: 2 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage blocked or full: the page keeps working, it just won't remember.
  }
}

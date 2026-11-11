import { normalizeCoins, type Coins } from '@/money/money';
import type { RankingSort } from '@/market/ranking';

export type BookTab = 'list' | 'analysis';

export type Preferences = {
  tab: BookTab;
  /** Filters the ranking and the recipe search; none selected means all. */
  professions: string[];
  /** Minimum profit per craft in the market analysis. */
  minProfit: Coins;
  /** How the market analysis orders its recipes. */
  sort: RankingSort;
};

type UnknownRecord = Record<string, unknown>;

/** Kept apart from the sheet, so erasing the page or a sheet format change never resets them. */
export const PREFERENCES_KEY = 'crafting-calculator:preferences';

export const DEFAULT_PREFERENCES: Preferences = {
  tab: 'list',
  professions: [],
  minProfit: { gold: 0, silver: 0, copper: 50 },
  sort: 'profitPerDay',
};

const TABS: BookTab[] = ['list', 'analysis'];
const SORTS: RankingSort[] = ['profitPerDay', 'margin'];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coinOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parsePreferences(value: unknown): Preferences {
  if (!isRecord(value)) return DEFAULT_PREFERENCES;
  const tab = TABS.find((candidate) => candidate === value.tab) ?? DEFAULT_PREFERENCES.tab;
  const professions = Array.isArray(value.professions)
    ? [...new Set(value.professions.filter((profession): profession is string => typeof profession === 'string'))]
    : DEFAULT_PREFERENCES.professions;
  const minProfit = isRecord(value.minProfit)
    ? normalizeCoins({ gold: coinOf(value.minProfit.gold), silver: coinOf(value.minProfit.silver), copper: coinOf(value.minProfit.copper) })
    : DEFAULT_PREFERENCES.minProfit;
  const sort = SORTS.find((candidate) => candidate === value.sort) ?? DEFAULT_PREFERENCES.sort;
  return { tab, professions, minProfit, sort };
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    return raw === null ? DEFAULT_PREFERENCES : parsePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage blocked or full: the page keeps working, it just won't remember.
  }
}

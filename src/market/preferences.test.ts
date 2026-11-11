import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, loadPreferences, PREFERENCES_KEY, savePreferences, type Preferences } from '@/market/preferences';

describe('preferences', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts with all professions, 50c minimum, by profit per day', () => {
    expect(loadPreferences()).toEqual({
      professions: [],
      minProfit: { gold: 0, silver: 0, copper: 50 },
      sort: 'profitPerDay',
    });
  });

  it('round-trips what was saved', () => {
    const saved: Preferences = {
      professions: ['Alchemy', 'Mining'],
      minProfit: { gold: 1, silver: 2, copper: 3 },
      sort: 'margin',
    };
    savePreferences(saved);
    expect(loadPreferences()).toEqual(saved);
  });

  it('repairs bad values field by field', () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ professions: ['Mining', 4, 'Mining'], minProfit: { gold: -1, silver: 150 }, sort: 'price' }),
    );
    expect(loadPreferences()).toEqual({
      professions: ['Mining'],
      minProfit: { gold: 1, silver: 50, copper: 0 },
      sort: 'profitPerDay',
    });
  });

  it('reads preferences saved before the sort existed as sorting by profit per day', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ professions: [], minProfit: { gold: 0, silver: 0, copper: 50 } }));
    expect(loadPreferences().sort).toBe('profitPerDay');
  });

  it('ignores a tab saved by an older version', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ tab: 'list', professions: [], minProfit: { gold: 0, silver: 0, copper: 50 }, sort: 'margin' }));
    expect(loadPreferences()).toEqual({
      professions: [],
      minProfit: { gold: 0, silver: 0, copper: 50 },
      sort: 'margin',
    });
  });

  it('falls back to the defaults on corrupted JSON or blocked storage', () => {
    localStorage.setItem(PREFERENCES_KEY, '{');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => savePreferences(DEFAULT_PREFERENCES)).not.toThrow();
  });
});

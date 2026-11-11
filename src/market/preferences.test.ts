import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, loadPreferences, PREFERENCES_KEY, savePreferences, type Preferences } from '@/market/preferences';

describe('preferences', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts on the market list, all professions, 50c minimum', () => {
    expect(loadPreferences()).toEqual({ tab: 'list', professions: [], minProfit: { gold: 0, silver: 0, copper: 50 } });
  });

  it('round-trips what was saved', () => {
    const saved: Preferences = { tab: 'analysis', professions: ['Alchemy', 'Mining'], minProfit: { gold: 1, silver: 2, copper: 3 } };
    savePreferences(saved);
    expect(loadPreferences()).toEqual(saved);
  });

  it('repairs bad values field by field', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ tab: 'other', professions: ['Mining', 4, 'Mining'], minProfit: { gold: -1, silver: 150 } }));
    expect(loadPreferences()).toEqual({ tab: 'list', professions: ['Mining'], minProfit: { gold: 1, silver: 50, copper: 0 } });
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

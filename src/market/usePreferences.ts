import { useEffect, useMemo, useState } from 'react';
import { coinsEqual, normalizeCoins, type Coins } from '@/money/money';
import type { RankingSort } from '@/market/ranking';
import { loadPreferences, savePreferences, type Preferences } from '@/market/preferences';

export type PreferenceActions = {
  setProfessions: (professions: string[]) => void;
  /** Keeps the coins as typed; normalizeMinProfit rolls them up when the field loses focus. */
  setMinProfit: (minProfit: Coins) => void;
  normalizeMinProfit: () => void;
  setSort: (sort: RankingSort) => void;
};

export type PreferencesState = {
  preferences: Preferences;
  actions: PreferenceActions;
};

export function usePreferences(): PreferencesState {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const actions = useMemo<PreferenceActions>(
    () => ({
      setProfessions: (professions) => setPreferences((current) => ({ ...current, professions })),
      setMinProfit: (minProfit) => setPreferences((current) => ({ ...current, minProfit })),
      normalizeMinProfit: () =>
        setPreferences((current) => {
          const minProfit = normalizeCoins(current.minProfit);
          return coinsEqual(minProfit, current.minProfit) ? current : { ...current, minProfit };
        }),
      setSort: (sort) => setPreferences((current) => (current.sort === sort ? current : { ...current, sort })),
    }),
    [],
  );

  return { preferences, actions };
}

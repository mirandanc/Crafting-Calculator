import { useEffect, useMemo, useState } from 'react';
import { coinsEqual, normalizeCoins, type Coins } from '@/money/money';
import { loadPreferences, savePreferences, type BookTab, type Preferences } from '@/market/preferences';

export type PreferenceActions = {
  setTab: (tab: BookTab) => void;
  setProfessions: (professions: string[]) => void;
  /** Keeps the coins as typed; normalizeMinProfit rolls them up when the field loses focus. */
  setMinProfit: (minProfit: Coins) => void;
  normalizeMinProfit: () => void;
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
      setTab: (tab) => setPreferences((current) => (current.tab === tab ? current : { ...current, tab })),
      setProfessions: (professions) => setPreferences((current) => ({ ...current, professions })),
      setMinProfit: (minProfit) => setPreferences((current) => ({ ...current, minProfit })),
      normalizeMinProfit: () =>
        setPreferences((current) => {
          const minProfit = normalizeCoins(current.minProfit);
          return coinsEqual(minProfit, current.minProfit) ? current : { ...current, minProfit };
        }),
    }),
    [],
  );

  return { preferences, actions };
}

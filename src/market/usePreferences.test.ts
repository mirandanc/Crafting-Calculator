import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadPreferences } from '@/market/preferences';
import { usePreferences } from '@/market/usePreferences';

describe('usePreferences', () => {
  beforeEach(() => localStorage.clear());

  it('changes and saves each preference', () => {
    const { result } = renderHook(() => usePreferences());
    act(() => result.current.actions.setTab('analysis'));
    act(() => result.current.actions.setProfessions(['Tailoring']));
    act(() => result.current.actions.setMinProfit({ gold: 0, silver: 0, copper: 250 }));
    expect(result.current.preferences.minProfit).toEqual({ gold: 0, silver: 0, copper: 250 });
    act(() => result.current.actions.normalizeMinProfit());
    expect(result.current.preferences.minProfit).toEqual({ gold: 0, silver: 2, copper: 50 });
    expect(loadPreferences()).toEqual({ tab: 'analysis', professions: ['Tailoring'], minProfit: { gold: 0, silver: 2, copper: 50 } });
  });
});

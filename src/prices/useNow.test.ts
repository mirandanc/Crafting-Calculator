import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from '@/prices/useNow';

const START = new Date('2026-11-10T16:00:00.000Z').getTime();

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the current time and moves on once per interval', () => {
    const { result } = renderHook(() => useNow(60_000));
    expect(result.current).toBe(START);
    act(() => {
      vi.advanceTimersByTime(59_999);
    });
    expect(result.current).toBe(START);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(START + 60_000);
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(result.current).toBe(START + 180_000);
  });

  it('stops ticking on unmount', () => {
    const { unmount } = renderHook(() => useNow(60_000));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

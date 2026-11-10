import { useEffect, useState } from 'react';

/** The current time in ms, refreshed every `intervalMs`, so time-based text (like a price list's age) updates in an idle tab. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

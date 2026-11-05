import { useCallback, useRef } from 'react';
import coinTossUrl from '@/assets/sounds/coin-toss.ogg';

const SOUND_VOLUME = 0.5;

export function useCoinSound(muted: boolean): () => void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  return useCallback(() => {
    if (muted) return;
    audioRef.current ??= Object.assign(new Audio(coinTossUrl), { volume: SOUND_VOLUME });
    audioRef.current.currentTime = 0;
    // play() rejects when the browser blocks audio; the sound is decoration, so ignore it.
    // Wrapped in Promise.resolve because jsdom (and some older browsers) can return undefined.
    void Promise.resolve(audioRef.current.play()).catch(() => undefined);
  }, [muted]);
}

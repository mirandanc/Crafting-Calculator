import { describe, expect, it } from 'vitest';
import { announceReady, pruneAnnounced } from '@/sound/chime';

describe('pruneAnnounced', () => {
  it('forgets ids that are no longer ready', () => {
    expect(pruneAnnounced(['a', 'b', 'gone'], ['a', 'c'])).toEqual(['a']);
  });

  it('returns the same array when nothing changes', () => {
    const announced = ['a'];
    expect(pruneAnnounced(announced, ['a', 'b'])).toBe(announced);
  });
});

describe('announceReady', () => {
  it('adds newly ready ids in order and reports them', () => {
    expect(announceReady(['b'], ['a', 'b', 'd'])).toEqual({ announced: ['b', 'a', 'd'], added: ['a', 'd'] });
  });

  it('returns the same array and no additions when everything was announced', () => {
    const announced = ['a'];
    const result = announceReady(announced, ['a']);
    expect(result.announced).toBe(announced);
    expect(result.added).toEqual([]);
  });
});

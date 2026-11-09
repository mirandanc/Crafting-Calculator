import { describe, expect, it } from 'vitest';
import { toRoman } from '@/components/EntryNumeral/toRoman';

describe('toRoman', () => {
  it.each([
    [1, 'I'],
    [2, 'II'],
    [3, 'III'],
    [4, 'IV'],
    [5, 'V'],
    [9, 'IX'],
    [10, 'X'],
    [14, 'XIV'],
    [40, 'XL'],
    [49, 'XLIX'],
    [90, 'XC'],
    [400, 'CD'],
    [944, 'CMXLIV'],
    [1994, 'MCMXCIV'],
    [3999, 'MMMCMXCIX'],
  ])('writes %i as %s', (position, numeral) => {
    expect(toRoman(position)).toBe(numeral);
  });

  it('falls back to digits outside the Roman range', () => {
    expect(toRoman(0)).toBe('0');
    expect(toRoman(-3)).toBe('-3');
    expect(toRoman(1.5)).toBe('1.5');
  });
});

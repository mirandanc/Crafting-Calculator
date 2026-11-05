import { describe, expect, it } from 'vitest';
import { formatMoney, fromCopper, GOLD_CAP_COPPER, normalizeCoins, toCopper } from '@/money/money';

describe('toCopper', () => {
  it('converts gold, silver and copper to copper', () => {
    expect(toCopper({ gold: 1, silver: 2, copper: 3 })).toBe(10_203);
  });

  it('treats negative, fractional and non-finite parts safely', () => {
    expect(toCopper({ gold: -1, silver: 2.9, copper: Number.NaN })).toBe(200);
  });

  it('caps at the gold cap', () => {
    expect(toCopper({ gold: 20_000_000, silver: 0, copper: 0 })).toBe(GOLD_CAP_COPPER);
    expect(GOLD_CAP_COPPER).toBe(99_999_999_999);
  });
});

describe('fromCopper', () => {
  it('splits copper into coins', () => {
    expect(fromCopper(10_203)).toEqual({ gold: 1, silver: 2, copper: 3 });
  });

  it('does not cap, so totals above the gold cap still split', () => {
    expect(fromCopper(GOLD_CAP_COPPER + 1)).toEqual({ gold: 10_000_000, silver: 0, copper: 0 });
  });
});

describe('normalizeCoins', () => {
  it('rolls copper up into silver', () => {
    expect(normalizeCoins({ gold: 0, silver: 0, copper: 150 })).toEqual({ gold: 0, silver: 1, copper: 50 });
  });

  it('rolls silver up into gold', () => {
    expect(normalizeCoins({ gold: 0, silver: 150, copper: 0 })).toEqual({ gold: 1, silver: 50, copper: 0 });
  });
});

describe('formatMoney', () => {
  it('shows only non-zero coins', () => {
    expect(formatMoney(125)).toBe('1s 25c');
    expect(formatMoney(10_000)).toBe('1g');
    expect(formatMoney(25)).toBe('25c');
  });

  it('shows 0c for zero', () => {
    expect(formatMoney(0)).toBe('0c');
  });

  it('groups thousands of gold', () => {
    expect(formatMoney(12_345_678_900)).toBe('1,234,567g 89s');
  });

  it('formats totals above the gold cap', () => {
    expect(formatMoney(GOLD_CAP_COPPER * 2)).toBe('19,999,999g 99s 98c');
  });
});

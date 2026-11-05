export type Coins = {
  gold: number;
  silver: number;
  copper: number;
};

const COPPER_PER_SILVER = 100;
const COPPER_PER_GOLD = 10_000;
export const GOLD_CAP_COPPER = 9_999_999 * COPPER_PER_GOLD + 99 * COPPER_PER_SILVER + 99;

const wholeOrZero = (value: number): number => (Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0);

export function toCopper(coins: Coins): number {
  const total =
    wholeOrZero(coins.gold) * COPPER_PER_GOLD + wholeOrZero(coins.silver) * COPPER_PER_SILVER + wholeOrZero(coins.copper);
  return Math.min(total, GOLD_CAP_COPPER);
}

export function fromCopper(total: number): Coins {
  const copper = wholeOrZero(total);
  return {
    gold: Math.floor(copper / COPPER_PER_GOLD),
    silver: Math.floor((copper % COPPER_PER_GOLD) / COPPER_PER_SILVER),
    copper: copper % COPPER_PER_SILVER,
  };
}

export function normalizeCoins(coins: Coins): Coins {
  return fromCopper(toCopper(coins));
}

export function formatMoney(total: number): string {
  const { gold, silver, copper } = fromCopper(total);
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold.toLocaleString('en-US')}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copper > 0 || parts.length === 0) parts.push(`${copper}c`);
  return parts.join(' ');
}

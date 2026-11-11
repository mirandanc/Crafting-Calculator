import { describe, expect, it } from 'vitest';
import { formatMargin, formatSalesCoverage, formatSoldPerDay, rankRecipes, type RankingFilter, type RankingMarket, type RankingSort } from '@/market/ranking';
import type { ItemSales } from '@/prices/auctionPrices';
import type { ItemPrices } from '@/prices/marketPrices';
import type { RecipeCatalog } from '@/recipes/catalog';
import { TEST_CATALOG, testRecipe } from '@/test/catalogFixture';

const without = (prices: ItemPrices, itemId: string): ItemPrices =>
  Object.fromEntries(Object.entries(prices).filter(([id]) => id !== itemId));

// Smelt Bronze: 2 Bronze Bar @ 900 → floor(1800 × 0.95) = 1710; costs 113 + 250 = 363; profit 1347 → 371%.
// Rough Copper Vest: 2000 → 1900; costs 4 × 113 = 452; profit 1448 → 320%.
// Bronze Tube: 5000 → 4750; costs 2 × 900 = 1800; profit 2950 → 164%.
const MARKET: RankingMarket = {
  auction: { '2840': 113, '3576': 250, '2841': 900, '10421': 2000, '4371': 5000 },
  quantities: { '2841': 10, '10421': 10, '4371': 10 },
  sales: null,
  salesDays: null,
  vendor: {},
};

const names = (catalog: RecipeCatalog, market: RankingMarket, professions: string[] = [], minProfit = 0, sort: RankingSort = 'margin'): string[] =>
  rankRecipes(catalog, market, { professions, minProfit }, sort).map((ranked) => ranked.recipe.name);

const ALL: RankingFilter = { professions: [], minProfit: 0 };

describe('rankRecipes', () => {
  it('ranks by margin after the 5% auction cut, highest first', () => {
    const ranked = rankRecipes(TEST_CATALOG, MARKET, { professions: [], minProfit: 0 }, 'margin');
    expect(ranked.map((entry) => [entry.recipe.name, entry.revenue, entry.cost, entry.profit])).toEqual([
      ['Smelt Bronze', 1710, 363, 1347],
      ['Rough Copper Vest', 1900, 452, 1448],
      ['Bronze Tube', 4750, 1800, 2950],
    ]);
  });

  it('lists each reagent with its count, unit price and source', () => {
    const [smelt] = rankRecipes(TEST_CATALOG, MARKET, { professions: [], minProfit: 0 }, 'margin');
    expect(smelt.reagents).toEqual([
      { itemId: 2840, name: 'Copper Bar', icon: 'https://foreverdb.net/icons/133216.webp', count: 1, unitPrice: 113, source: 'auction' },
      { itemId: 3576, name: 'Tin Bar', icon: 'https://foreverdb.net/icons/133219.webp', count: 1, unitPrice: 250, source: 'auction' },
    ]);
  });

  it('buys a reagent from the vendor when that is cheaper', () => {
    const [smelt] = rankRecipes(TEST_CATALOG, { ...MARKET, vendor: { '3576': 200 } }, { professions: [], minProfit: 0 }, 'margin');
    expect(smelt.cost).toBe(313);
    expect(smelt.reagents[1]).toMatchObject({ unitPrice: 200, source: 'vendor' });
  });

  it('never sells the result to a vendor price', () => {
    expect(names(TEST_CATALOG, { ...MARKET, auction: without(MARKET.auction, '4371'), vendor: { '4371': 9000 } })).not.toContain(
      'Bronze Tube',
    );
  });

  it('leaves out recipes with a cooldown, that make nothing, or that cannot be priced', () => {
    const catalog: RecipeCatalog = {
      ...TEST_CATALOG,
      recipes: TEST_CATALOG.recipes.map((recipe) => (recipe.name === 'Bronze Tube' ? { ...recipe, cooldown: true } : recipe)),
    };
    expect(names(catalog, MARKET)).toEqual(['Smelt Bronze', 'Rough Copper Vest']);
    // Tin Bar has no price at all: Smelt Bronze can't be priced.
    expect(names(TEST_CATALOG, { ...MARKET, auction: without(MARKET.auction, '3576') })).toEqual(['Rough Copper Vest', 'Bronze Tube']);
  });

  it('hides results with fewer than 5 for sale, unless quantities are unknown', () => {
    expect(names(TEST_CATALOG, { ...MARKET, quantities: { ...MARKET.quantities, '10421': 4 } })).toEqual(['Smelt Bronze', 'Bronze Tube']);
    expect(names(TEST_CATALOG, { ...MARKET, quantities: null })).toHaveLength(3);
  });

  it('keeps only the selected professions and recipes earning at least the minimum', () => {
    expect(names(TEST_CATALOG, MARKET, ['Mining', 'Engineering'])).toEqual(['Smelt Bronze', 'Bronze Tube']);
    expect(names(TEST_CATALOG, MARKET, [], 1448)).toEqual(['Rough Copper Vest', 'Bronze Tube']);
  });

  it('breaks a margin tie by profit, then by name', () => {
    const catalog: RecipeCatalog = {
      ...TEST_CATALOG,
      recipes: [
        { ...TEST_CATALOG.recipes[1], id: 1, name: 'B Vest' },
        { ...TEST_CATALOG.recipes[1], id: 2, name: 'A Vest' },
      ],
    };
    expect(names(catalog, MARKET)).toEqual(['A Vest', 'B Vest']);
  });

  it('floors the revenue when the auction cut leaves a fraction', () => {
    // 901 × 2 × 0.95 = 1711.9, not a whole number.
    const market: RankingMarket = { ...MARKET, auction: { ...MARKET.auction, '2841': 901 } };
    const ranked = rankRecipes(TEST_CATALOG, market, { professions: [], minProfit: 0 }, 'margin');
    const smelt = ranked.find((entry) => entry.recipe.name === 'Smelt Bronze');
    expect(smelt).toMatchObject({ revenue: 1711, cost: 363, profit: 1348 });
  });

  it('breaks a margin tie by profit when one recipe is a scaled-up copy of another', () => {
    const bigVestItemId = 50001;
    const catalog: RecipeCatalog = {
      ...TEST_CATALOG,
      recipes: [
        testRecipe('Rough Copper Vest'),
        {
          ...testRecipe('Rough Copper Vest'),
          id: 99999,
          name: 'Big Vest',
          reagents: [{ itemId: 2840, count: 8 }],
          makes: { itemId: bigVestItemId, name: 'Big Vest', count: 1 },
        },
      ],
    };
    const market: RankingMarket = {
      ...MARKET,
      auction: { ...MARKET.auction, [String(bigVestItemId)]: 4000 },
      quantities: { ...MARKET.quantities, [String(bigVestItemId)]: 10 },
    };
    // Same margin as Rough Copper Vest (costs and sells exactly double), but twice the profit.
    expect(names(catalog, market)).toEqual(['Big Vest', 'Rough Copper Vest']);
  });

  it('excludes a recipe that makes nothing, even when its reagent is priced', () => {
    expect(names(TEST_CATALOG, { ...MARKET, auction: { ...MARKET.auction, '247786': 50 } })).not.toContain(
      'Enchant Bracer - Inferior Stamina',
    );
  });

  it('excludes a recipe whose reagents cost nothing', () => {
    const market: RankingMarket = { ...MARKET, auction: { ...MARKET.auction, '2840': 0, '3576': 0 } };
    expect(names(TEST_CATALOG, market)).not.toContain('Smelt Bronze');
  });
});

describe('formatMargin', () => {
  it('shows a whole percentage', () => {
    expect(formatMargin(1347 / 363)).toBe('371%');
    expect(formatMargin(0)).toBe('0%');
    expect(formatMargin(12.3456)).toBe('1,235%');
  });
});

// With sales, each product sells at the lower of its auction price and its average sale price:
// Smelt Bronze: min(900, 1000) = 900 → profit 1347 × 6 a day = 8082/day; margin 371%.
// Rough Copper Vest: min(2000, 1500) = 1500 → floor(1425) = 1425; profit 1425 − 452 = 973 × 20 = 19460/day; margin 215%.
// Bronze Tube: min(5000, 5000) → profit 2950 × 5 = 14750/day; margin 164%.
const SALES: Record<string, ItemSales> = {
  '2841': { perDay: 6, price: 1000 },
  '10421': { perDay: 20, price: 1500 },
  '4371': { perDay: 5, price: 5000 },
};
const SOLD: RankingMarket = { ...MARKET, sales: SALES, salesDays: 3.4 };

describe('rankRecipes with estimated sales', () => {
  it('ranks by profit per day, selling at the lower of the auction and the average sale price', () => {
    const ranked = rankRecipes(TEST_CATALOG, SOLD, ALL, 'profitPerDay');
    expect(ranked.map((entry) => [entry.recipe.name, entry.revenue, entry.profit, entry.salesPerDay, entry.profitPerDay])).toEqual([
      ['Rough Copper Vest', 1425, 973, 20, 19460],
      ['Bronze Tube', 4750, 2950, 5, 14750],
      ['Smelt Bronze', 1710, 1347, 6, 8082],
    ]);
  });

  it('ranks by margin when asked, then by profit and name', () => {
    expect(names(TEST_CATALOG, SOLD, [], 0, 'margin')).toEqual(['Smelt Bronze', 'Rough Copper Vest', 'Bronze Tube']);
  });

  it('breaks a profit-per-day tie by margin, then by name', () => {
    // Three results all earning 19460 a day:
    // - Rough Copper Vest: 973 × 20; margin 973 ÷ 452 = 215%.
    // - Big Vest (8 Copper Bar → item 50001 at 3000, 10 a day): floor(2850) − 904 = 1946 × 10; margin 1946 ÷ 904,
    //   the same fraction as Rough Copper Vest's, so the name decides between those two.
    // - Zinc Vest (2 Copper Bar → item 50002 at 1263, 20 a day): floor(1199.85) − 226 = 973 × 20; margin 431%, so first.
    const bigVest = 50001;
    const zincVest = 50002;
    const catalog: RecipeCatalog = {
      ...TEST_CATALOG,
      recipes: [
        testRecipe('Rough Copper Vest'),
        {
          ...testRecipe('Rough Copper Vest'),
          id: 99998,
          name: 'Big Vest',
          reagents: [{ itemId: 2840, count: 8 }],
          makes: { itemId: bigVest, name: 'Big Vest', count: 1 },
        },
        {
          ...testRecipe('Rough Copper Vest'),
          id: 99999,
          name: 'Zinc Vest',
          reagents: [{ itemId: 2840, count: 2 }],
          makes: { itemId: zincVest, name: 'Zinc Vest', count: 1 },
        },
      ],
    };
    const market: RankingMarket = {
      ...SOLD,
      auction: { ...SOLD.auction, [String(bigVest)]: 3000, [String(zincVest)]: 1263 },
      quantities: { ...SOLD.quantities, [String(bigVest)]: 10, [String(zincVest)]: 10 },
      sales: { ...SALES, [String(bigVest)]: { perDay: 10, price: 3000 }, [String(zincVest)]: { perDay: 20, price: 1263 } },
    };
    expect(names(catalog, market, [], 0, 'profitPerDay')).toEqual(['Zinc Vest', 'Big Vest', 'Rough Copper Vest']);
  });

  it('hides products that sell fewer than 5 a day, or have no sales at all', () => {
    expect(names(TEST_CATALOG, { ...SOLD, sales: { ...SALES, '4371': { perDay: 4.99, price: 5000 } } }, [], 0, 'profitPerDay')).toEqual([
      'Rough Copper Vest',
      'Smelt Bronze',
    ]);
    const noVestSales: Record<string, ItemSales> = { '2841': SALES['2841'], '4371': SALES['4371'] };
    expect(names(TEST_CATALOG, { ...SOLD, sales: noVestSales }, [], 0, 'profitPerDay')).toEqual(['Bronze Tube', 'Smelt Bronze']);
  });

  it('needs at least 5 counted sales before trusting the rate', () => {
    const smeltWith = (perDay: number, salesDays: number): string[] =>
      names(TEST_CATALOG, { ...SOLD, sales: { '2841': { perDay, price: 1000 } }, salesDays }, [], 0, 'profitPerDay');
    // 1 sale in an hour reads as 24 a day, but it is still a single sale.
    expect(smeltWith(24, 1 / 24)).toEqual([]);
    expect(smeltWith(6, 1)).toEqual(['Smelt Bronze']);
    // 120 a day over an hour is 5 sales, despite the float rounding of 120 × 1/24.
    expect(smeltWith(120, 1 / 24)).toEqual(['Smelt Bronze']);
  });

  it('still hides results with fewer than 5 for sale', () => {
    expect(names(TEST_CATALOG, { ...SOLD, quantities: { ...MARKET.quantities, '4371': 4 } }, [], 0, 'profitPerDay')).toEqual([
      'Rough Copper Vest',
      'Smelt Bronze',
    ]);
  });

  it('rounds the profit per day to whole copper', () => {
    const market: RankingMarket = { ...SOLD, sales: { ...SALES, '2841': { perDay: 6.5, price: 1000 } } };
    const smelt = rankRecipes(TEST_CATALOG, market, ALL, 'profitPerDay').find((entry) => entry.recipe.name === 'Smelt Bronze');
    // 1347 × 6.5 = 8755.5 → 8755, rounded down.
    expect(smelt).toMatchObject({ salesPerDay: 6.5, profitPerDay: 8755 });
  });

  it('falls back to margin, with no per-day figures, while sales are unknown', () => {
    const ranked = rankRecipes(TEST_CATALOG, MARKET, ALL, 'profitPerDay');
    expect(ranked.map((entry) => [entry.recipe.name, entry.salesPerDay, entry.profitPerDay])).toEqual([
      ['Smelt Bronze', null, null],
      ['Rough Copper Vest', null, null],
      ['Bronze Tube', null, null],
    ]);
  });
});

describe('the margin ceiling', () => {
  // Copper Bar at 25: Rough Copper Vest costs 4 × 25 = 100.
  it('keeps exactly 1500% and hides anything above it', () => {
    // floor(1685 × 0.95) = 1600 → profit 1500 → margin 15.
    const atCeiling: RankingMarket = { ...MARKET, auction: { ...MARKET.auction, '2840': 25, '10421': 1685 } };
    const vest = rankRecipes(TEST_CATALOG, atCeiling, ALL, 'margin').find((entry) => entry.recipe.name === 'Rough Copper Vest');
    expect(vest).toMatchObject({ revenue: 1600, cost: 100, margin: 15 });
    // floor(1686 × 0.95) = 1601 → margin 15.01.
    const above: RankingMarket = { ...MARKET, auction: { ...MARKET.auction, '2840': 25, '10421': 1686 } };
    expect(names(TEST_CATALOG, above)).not.toContain('Rough Copper Vest');
  });

  it('applies with sales too', () => {
    const cheapReagents: RankingMarket = { ...SOLD, auction: { ...SOLD.auction, '2840': 1, '3576': 1 } };
    // Smelt: 1710 on 2c of reagents; Vest: 1425 on 4c. Only Bronze Tube is left.
    expect(names(TEST_CATALOG, cheapReagents, [], 0, 'profitPerDay')).toEqual(['Bronze Tube']);
  });
});

describe('formatSoldPerDay', () => {
  it('gives whole numbers, rounded down', () => {
    expect(formatSoldPerDay(14.9)).toBe('14 sold in a day');
    expect(formatSoldPerDay(1234.5)).toBe('1,234 sold in a day');
    expect(formatSoldPerDay(6.43)).toBe('6 sold in a day');
    expect(formatSoldPerDay(5)).toBe('5 sold in a day');
    expect(formatSoldPerDay(9.96)).toBe('9 sold in a day');
  });
});

describe('formatSalesCoverage', () => {
  it('gives whole days rounded down, and "< 1 day" before a full day', () => {
    expect(formatSalesCoverage(3.9)).toBe('Sales from the last 3 days');
    expect(formatSalesCoverage(7)).toBe('Sales from the last 7 days');
    expect(formatSalesCoverage(1.99)).toBe('Sales from the last 1 day');
    expect(formatSalesCoverage(0.25)).toBe('Sales from the last < 1 day');
    expect(formatSalesCoverage(0.01)).toBe('Sales from the last < 1 day');
  });
});

import { describe, expect, it } from 'vitest';
import { formatMargin, rankRecipes, type RankingMarket } from '@/market/ranking';
import type { ItemPrices } from '@/prices/marketPrices';
import type { RecipeCatalog } from '@/recipes/catalog';
import { TEST_CATALOG } from '@/test/catalogFixture';

const without = (prices: ItemPrices, itemId: string): ItemPrices =>
  Object.fromEntries(Object.entries(prices).filter(([id]) => id !== itemId));

// Smelt Bronze: 2 Bronze Bar @ 900 → floor(1800 × 0.95) = 1710; costs 113 + 250 = 363; profit 1347 → 371%.
// Rough Copper Vest: 2000 → 1900; costs 4 × 113 = 452; profit 1448 → 320%.
// Bronze Tube: 5000 → 4750; costs 2 × 900 = 1800; profit 2950 → 164%.
const MARKET: RankingMarket = {
  auction: { '2840': 113, '3576': 250, '2841': 900, '10421': 2000, '4371': 5000 },
  quantities: { '2841': 10, '10421': 10, '4371': 10 },
  vendor: {},
};

const names = (catalog: RecipeCatalog, market: RankingMarket, professions: string[] = [], minProfit = 0): string[] =>
  rankRecipes(catalog, market, { professions, minProfit }).map((ranked) => ranked.recipe.name);

describe('rankRecipes', () => {
  it('ranks by margin after the 5% auction cut, highest first', () => {
    const ranked = rankRecipes(TEST_CATALOG, MARKET, { professions: [], minProfit: 0 });
    expect(ranked.map((entry) => [entry.recipe.name, entry.revenue, entry.cost, entry.profit])).toEqual([
      ['Smelt Bronze', 1710, 363, 1347],
      ['Rough Copper Vest', 1900, 452, 1448],
      ['Bronze Tube', 4750, 1800, 2950],
    ]);
  });

  it('lists each reagent with its count, unit price and source', () => {
    const [smelt] = rankRecipes(TEST_CATALOG, MARKET, { professions: [], minProfit: 0 });
    expect(smelt.reagents).toEqual([
      { itemId: 2840, name: 'Copper Bar', icon: 'https://foreverdb.net/icons/133216.webp', count: 1, unitPrice: 113, source: 'auction' },
      { itemId: 3576, name: 'Tin Bar', icon: 'https://foreverdb.net/icons/133219.webp', count: 1, unitPrice: 250, source: 'auction' },
    ]);
  });

  it('buys a reagent from the vendor when that is cheaper', () => {
    const [smelt] = rankRecipes(TEST_CATALOG, { ...MARKET, vendor: { '3576': 200 } }, { professions: [], minProfit: 0 });
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
});

describe('formatMargin', () => {
  it('shows a whole percentage', () => {
    expect(formatMargin(1347 / 363)).toBe('371%');
    expect(formatMargin(0)).toBe('0%');
    expect(formatMargin(12.3456)).toBe('1,235%');
  });
});

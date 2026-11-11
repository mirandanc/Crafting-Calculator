import type { CatalogRecipe, RecipeCatalog } from '@/recipes/catalog';

export const TEST_CATALOG: RecipeCatalog = {
  build: 'test',
  items: {
    '2840': { name: 'Copper Bar', icon: 'https://foreverdb.net/icons/133216.webp' },
    '2841': { name: 'Bronze Bar', icon: 'https://foreverdb.net/icons/133227.webp' },
    '3576': { name: 'Tin Bar', icon: 'https://foreverdb.net/icons/133219.webp' },
    '247786': { name: 'Mote of Magic', icon: null },
  },
  vendorPrices: {},
  recipes: [
    {
      id: 2659,
      name: 'Smelt Bronze',
      profession: 'Mining',
      icon: 'https://foreverdb.net/icons/133227.webp',
      makes: { itemId: 2841, name: 'Bronze Bar', count: 2 },
      reagents: [
        { itemId: 2840, count: 1 },
        { itemId: 3576, count: 1 },
      ],
    },
    {
      id: 12260,
      name: 'Rough Copper Vest',
      profession: 'Blacksmithing',
      icon: 'https://foreverdb.net/icons/132624.webp',
      makes: { itemId: 10421, name: 'Rough Copper Vest', count: 1 },
      reagents: [{ itemId: 2840, count: 4 }],
    },
    {
      id: 3938,
      name: 'Bronze Tube',
      profession: 'Engineering',
      icon: 'https://foreverdb.net/icons/133024.webp',
      makes: { itemId: 4371, name: 'Bronze Tube', count: 1 },
      reagents: [{ itemId: 2841, count: 2 }],
    },
    {
      id: 7418,
      name: 'Enchant Bracer - Inferior Stamina',
      profession: 'Enchanting',
      icon: 'https://foreverdb.net/icons/136244.webp',
      makes: null,
      reagents: [{ itemId: 247786, count: 1 }],
    },
  ],
};

export function testRecipe(name: string): CatalogRecipe {
  const recipe = TEST_CATALOG.recipes.find((candidate) => candidate.name === name);
  if (recipe === undefined) throw new Error(`No test recipe named ${name}`);
  return recipe;
}

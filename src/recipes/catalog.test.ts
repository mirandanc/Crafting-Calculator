import { describe, expect, it } from 'vitest';
import { searchRecipes } from '@/recipes/catalog';
import { TEST_CATALOG } from '@/test/catalogFixture';

describe('searchRecipes', () => {
  it('needs 3 letters', () => {
    expect(searchRecipes(TEST_CATALOG, 'br')).toEqual([]);
  });

  it('ranks prefix matches before contains matches', () => {
    expect(searchRecipes(TEST_CATALOG, 'bronze').map((recipe) => recipe.name)).toEqual(['Bronze Tube', 'Smelt Bronze']);
  });

  it('finds recipes that make no item', () => {
    expect(searchRecipes(TEST_CATALOG, 'enchant bracer').map((recipe) => recipe.id)).toEqual([7418]);
  });
});

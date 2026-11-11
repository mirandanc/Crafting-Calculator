import { describe, expect, it } from 'vitest';
import { professionsOf, searchRecipes } from '@/recipes/catalog';
import { TEST_CATALOG } from '@/test/catalogFixture';

describe('searchRecipes', () => {
  it('needs 3 letters', () => {
    expect(searchRecipes(TEST_CATALOG, 'br', [])).toEqual([]);
  });

  it('ranks prefix matches before contains matches', () => {
    expect(searchRecipes(TEST_CATALOG, 'bronze', []).map((recipe) => recipe.name)).toEqual(['Bronze Tube', 'Smelt Bronze']);
  });

  it('finds recipes that make no item', () => {
    expect(searchRecipes(TEST_CATALOG, 'enchant bracer', []).map((recipe) => recipe.id)).toEqual([7418]);
  });
});

describe('professionsOf', () => {
  it('lists each profession once, sorted', () => {
    expect(professionsOf(TEST_CATALOG)).toEqual(['Blacksmithing', 'Enchanting', 'Engineering', 'Mining']);
  });
});

describe('searchRecipes with professions', () => {
  it('searches every profession when none is selected', () => {
    expect(searchRecipes(TEST_CATALOG, 'bronze', []).map((recipe) => recipe.name)).toEqual(['Bronze Tube', 'Smelt Bronze']);
  });

  it('only searches the selected professions', () => {
    expect(searchRecipes(TEST_CATALOG, 'bronze', ['Mining']).map((recipe) => recipe.name)).toEqual(['Smelt Bronze']);
  });
});

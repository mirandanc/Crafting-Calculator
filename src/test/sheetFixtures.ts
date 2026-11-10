import { fromCopper, type Coins } from '@/money/money';
import { withRecipe, type ItemRow, type RecipeBlock } from '@/sheet/sheet';
import { TEST_CATALOG, testRecipe } from '@/test/catalogFixture';

/** A recipe block with a recipe from TEST_CATALOG picked and ×N set to `wanted`. */
export function recipeBlock(id: string, recipeName: string, wanted: number | null): RecipeBlock {
  const empty: RecipeBlock = { kind: 'recipe', id, recipe: null, wanted: null };
  return { ...withRecipe(empty, testRecipe(recipeName), TEST_CATALOG.items), wanted };
}

/** An item row; pass an item id to make it linked (with a made-up icon URL). */
export function itemRow(id: string, name: string, quantity: number | null, itemId: number | null = null): ItemRow {
  return {
    kind: 'item',
    id,
    name,
    itemId,
    icon: itemId === null ? null : `https://foreverdb.net/icons/${itemId}.webp`,
    quantity,
  };
}

export function coins(copper: number): Coins {
  return fromCopper(copper);
}

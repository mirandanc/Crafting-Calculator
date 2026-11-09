import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { RecipeBlockEditor } from '@/components/RecipeBlockEditor/RecipeBlockEditor';
import type { Prices, RecipeBlock } from '@/sheet/sheet';
import { TEST_CATALOG } from '@/test/catalogFixture';
import { coins, recipeBlock } from '@/test/sheetFixtures';

type Props = ComponentProps<typeof RecipeBlockEditor>;

type Handlers = {
  onChoose: Mock<Props['onChoose']>;
  onWantedChange: Mock<Props['onWantedChange']>;
  onRemoveReagent: Mock<Props['onRemoveReagent']>;
  onPriceChange: Mock<Props['onPriceChange']>;
  onPriceBlur: Mock<Props['onPriceBlur']>;
  onRemove: Mock<Props['onRemove']>;
};

const EMPTY_BLOCK: RecipeBlock = { kind: 'recipe', id: 'r', recipe: null, wanted: null };

const renderBlock = (block: RecipeBlock, prices: Prices = {}) => {
  const handlers: Handlers = {
    onChoose: vi.fn(),
    onWantedChange: vi.fn(),
    onRemoveReagent: vi.fn(),
    onPriceChange: vi.fn(),
    onPriceBlur: vi.fn(),
    onRemove: vi.fn(),
  };
  render(<RecipeBlockEditor block={block} position={1} catalog={TEST_CATALOG} prices={prices} {...handlers} />);
  return { handlers, user: userEvent.setup(), article: screen.getByRole('article', { name: 'Recipe 1' }) };
};

describe('RecipeBlockEditor', () => {
  it('searches the catalog and hands back the picked recipe with the catalog items', async () => {
    const { handlers, user, article } = renderBlock(EMPTY_BLOCK);
    await user.type(within(article).getByRole('combobox', { name: 'Recipe' }), 'smelt');
    await user.click(screen.getByRole('option', { name: /Smelt Bronze/ }));
    expect(handlers.onChoose).toHaveBeenCalledWith(TEST_CATALOG.recipes[0], TEST_CATALOG.items);
    expect(within(article).getByRole('combobox', { name: 'Recipe' })).toHaveValue('Smelt Bronze');
  });

  it('shows ×N, the craft note and locked reagent quantities', () => {
    const { article } = renderBlock(recipeBlock('r', 'Smelt Bronze', 11));
    expect(within(article).getByLabelText('Amount wanted')).toHaveValue(11);
    expect(within(article).getByText('6 crafts → 12 Bronze Bar (1 extra)')).toBeInTheDocument();
    const copper = within(article).getByRole('listitem', { name: 'Copper Bar' });
    expect(within(copper).getByText('6')).toBeInTheDocument();
    expect(within(copper).getByLabelText('Copper Bar price copper')).toBeInTheDocument();
  });

  it('shows the recipe icon in place of the numeral', () => {
    const { article } = renderBlock(recipeBlock('r', 'Smelt Bronze', 1));
    expect(within(article).queryByText('I')).toBeNull();
    expect(article.querySelector('img')).toHaveAttribute('src', 'https://foreverdb.net/icons/133227.webp');
  });

  it('labels ×N as casts when the recipe makes no item', () => {
    const { article } = renderBlock(recipeBlock('r', 'Enchant Bracer - Inferior Stamina', 3));
    expect(within(article).getByLabelText('Casts')).toHaveValue(3);
  });

  it('reads shared prices and reports price edits by item key', async () => {
    const { handlers, user, article } = renderBlock(recipeBlock('r', 'Smelt Bronze', 1), { 'name:copper bar': coins(10) });
    expect(within(article).getByLabelText('Copper Bar price copper')).toHaveValue(10);
    await user.type(within(article).getByLabelText('Tin Bar price copper'), '5');
    expect(handlers.onPriceChange).toHaveBeenLastCalledWith('name:tin bar', { gold: 0, silver: 0, copper: 5 });
  });

  it('removes a reagent', async () => {
    const { handlers, user } = renderBlock(recipeBlock('r', 'Smelt Bronze', 1));
    await user.click(screen.getByRole('button', { name: 'Remove Tin Bar from Smelt Bronze' }));
    expect(handlers.onRemoveReagent).toHaveBeenCalledWith(3576);
  });

  it('reports ×N edits', async () => {
    const { handlers, user, article } = renderBlock(recipeBlock('r', 'Smelt Bronze', null));
    await user.type(within(article).getByLabelText('Amount wanted'), '4');
    expect(handlers.onWantedChange).toHaveBeenLastCalledWith(4);
  });

  it('puts the picked recipe name back when the field is left without picking another', async () => {
    const { user, article } = renderBlock(recipeBlock('r', 'Smelt Bronze', 1));
    const input = within(article).getByRole('combobox', { name: 'Recipe' });
    await user.clear(input);
    await user.type(input, 'xyz');
    await user.tab();
    expect(input).toHaveValue('Smelt Bronze');
  });
});

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { App } from '@/App';
import recipesUrl from '@/data/recipes.json?url';
import type { ForeverItem } from '@/foreverdb/itemSearch';
import { loadRecipeCatalog } from '@/recipes/loadRecipeCatalog';
import { TEST_CATALOG } from '@/test/catalogFixture';

type User = ReturnType<typeof userEvent.setup>;

type RenderedApp = {
  user: User;
  unmount: () => void;
  list: () => HTMLElement;
};

const COPPER_BAR: ForeverItem = {
  id: 2840,
  name: 'Copper Bar',
  icon: 'https://foreverdb.net/icons/133216.webp',
  speculation: false,
  betaEvent: false,
};

const SEARCH_RESULTS: ForeverItem[] = [
  COPPER_BAR,
  { ...COPPER_BAR, id: 900001, name: 'Copper Bar Crate', betaEvent: true },
  { ...COPPER_BAR, id: 900002, name: 'Copper Bar Mold', speculation: true },
];

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body));

const renderApp = async (): Promise<RenderedApp> => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const view = render(<App />);
  // The App asked for the catalog on mount; awaiting the same cached promise lets its answer land.
  await act(async () => {
    await loadRecipeCatalog();
  });
  return { user, unmount: view.unmount, list: () => screen.getByRole('region', { name: 'Shopping list' }) };
};

const recipeArticle = (position: number) => screen.getByRole('article', { name: `Recipe ${position}` });
const itemArticle = (position: number) => screen.getByRole('article', { name: `Item ${position}` });
const articleNames = () => screen.getAllByRole('article').map((article) => article.getAttribute('aria-label'));

const pickRecipe = async (user: User, position: number, query: string, name: RegExp) => {
  const search = within(recipeArticle(position)).getByRole('combobox', { name: 'Recipe' });
  await user.clear(search);
  await user.type(search, query);
  await user.click(screen.getByRole('option', { name }));
};

const setWanted = async (user: User, position: number, amount: string) => {
  const input = within(recipeArticle(position)).getByLabelText('Amount wanted');
  await user.clear(input);
  await user.type(input, amount);
};

const linkCopperBar = async (user: User, position: number) => {
  await user.type(within(itemArticle(position)).getByRole('combobox', { name: 'Item name' }), 'copper');
  await user.click(await screen.findByRole('option', { name: 'Copper Bar' }));
};

// Async act: the timers that fire may start a search, whose answer lands before act returns.
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const waitForChime = () => advance(800);

describe('App', () => {
  let play: MockInstance<HTMLMediaElement['play']>;
  let fetchMock: Mock<typeof fetch>;
  let answerItemSearch: Mock<() => Promise<Response>>;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // RTL's asyncWrapper (jestFakeTimersAreEnabled) only advances fake timers on its own when it
    // detects a `jest` global; Vitest's fake timers alone aren't picked up, so shim it.
    vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    answerItemSearch = vi.fn(async () => jsonResponse({ data: SEARCH_RESULTS }));
    fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === recipesUrl) return jsonResponse(TEST_CATALOG);
      if (url.startsWith('/api/items?')) return answerItemSearch();
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts with one empty recipe field and an empty shopping list', async () => {
    const { list } = await renderApp();
    expect(articleNames()).toEqual(['Recipe 1']);
    expect(within(recipeArticle(1)).getByRole('combobox', { name: 'Recipe' })).toHaveValue('');
    expect(within(list()).getByRole('heading', { name: 'Shopping list' })).toBeInTheDocument();
    expect(within(list()).getByText('Nothing to buy yet.')).toBeInTheDocument();
    expect(within(list()).queryByText('Total cost')).toBeNull();
  });

  it('searches recipes locally, best match first, with their profession', async () => {
    const { user } = await renderApp();
    await user.type(within(recipeArticle(1)).getByRole('combobox', { name: 'Recipe' }), 'bronze');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Bronze TubeEngineering',
      'Smelt BronzeMining',
    ]);
    expect(answerItemSearch).not.toHaveBeenCalled();
  });

  it('picks a recipe with the keyboard and lists its reagents, unpriced', async () => {
    const { user, list } = await renderApp();
    const search = within(recipeArticle(1)).getByRole('combobox', { name: 'Recipe' });
    await user.type(search, 'smelt');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(search).toHaveValue('Smelt Bronze');
    const reagents = within(recipeArticle(1)).getByRole('list', { name: 'Reagents for Smelt Bronze' });
    expect(within(reagents).getAllByRole('listitem').map((item) => item.getAttribute('aria-label'))).toEqual([
      'Copper Bar',
      'Tin Bar',
    ]);
    expect(within(recipeArticle(1)).getByLabelText('Amount wanted')).toHaveValue(1);
    expect(within(list()).getAllByText('Smelt Bronze')).toHaveLength(2);
    expect(within(list()).getByText('2 items unpriced')).toBeInTheDocument();
    expect(within(list()).queryByText(/×/)).toBeNull();
  });

  it('rounds crafts up for the amount wanted and keeps reagent quantities locked', async () => {
    const { user } = await renderApp();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    await setWanted(user, 1, '11');
    expect(within(recipeArticle(1)).getByText('6 crafts → 12 Bronze Bar (1 extra)')).toBeInTheDocument();
    const copper = within(recipeArticle(1)).getByRole('listitem', { name: 'Copper Bar' });
    expect(within(copper).getByText('6')).toBeInTheDocument();
    expect(within(copper).queryByRole('spinbutton', { name: /quantity/i })).toBeNull();
  });

  it('counts casts for recipes that make no item', async () => {
    const { user } = await renderApp();
    await pickRecipe(user, 1, 'enchant', /Enchant Bracer/);
    expect(within(recipeArticle(1)).getByLabelText('Casts')).toHaveValue(1);
  });

  it('shares one price per item and merges it in the shopping list', async () => {
    const { user, list } = await renderApp();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    await setWanted(user, 1, '2');
    await user.click(screen.getByRole('button', { name: 'Add recipe' }));
    await pickRecipe(user, 2, 'rough copper', /Rough Copper Vest/);
    const [first, second] = screen.getAllByLabelText('Copper Bar price copper');
    await user.type(first, '10');
    expect(second).toHaveValue(10);
    expect(within(list()).getByText('Smelt Bronze, Rough Copper Vest')).toBeInTheDocument();
    expect(within(list()).getByText('5 ×')).toBeInTheDocument();
    expect(within(list()).getByText('= 50c')).toBeInTheDocument();
    expect(within(list()).getByText('1 item unpriced')).toBeInTheDocument();
  });

  it('gives a typed item the same line and price as the linked reagent of that name', async () => {
    const { user, list } = await renderApp();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const row = itemArticle(2);
    await user.type(within(row).getByRole('combobox', { name: 'Item name' }), 'copper bar');
    // Let its (unpicked) search answer settle: the row stays free text.
    await advance(300);
    await user.type(within(row).getByLabelText('Quantity'), '3');
    await user.type(within(row).getByLabelText('Unit price copper'), '10');
    // Still typed, not linked: the numeral stays.
    expect(within(row).getByText('II')).toBeInTheDocument();
    expect(within(recipeArticle(1)).getByLabelText('Copper Bar price copper')).toHaveValue(10);
    expect(within(list()).getAllByText('Copper Bar')).toHaveLength(1);
    expect(within(list()).queryByText('copper bar')).toBeNull();
    expect(within(list()).getByText('4 ×')).toBeInTheDocument();
    expect(within(list()).getByText('= 40c')).toBeInTheDocument();
    expect(within(list()).getByText('1 item unpriced')).toBeInTheDocument();
  });

  it('removes a reagent and restores it when the recipe is picked again', async () => {
    const { user, list } = await renderApp();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    await user.click(screen.getByRole('button', { name: 'Remove Tin Bar from Smelt Bronze' }));
    expect(within(recipeArticle(1)).queryByRole('listitem', { name: 'Tin Bar' })).toBeNull();
    expect(within(list()).queryByText('Tin Bar')).toBeNull();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    expect(within(recipeArticle(1)).getByRole('listitem', { name: 'Tin Bar' })).toBeInTheDocument();
    expect(within(list()).getByText('Tin Bar')).toBeInTheDocument();
  });

  it('searches ForeverDB 300 ms after typing stops, hides event and speculation items, and shows the icon', async () => {
    const { user, list } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(within(itemArticle(2)).getByText('II')).toBeInTheDocument();
    await user.type(within(itemArticle(2)).getByRole('combobox', { name: 'Item name' }), 'copper');
    await advance(299);
    expect(answerItemSearch).not.toHaveBeenCalled();
    await advance(1);
    const option = await screen.findByRole('option', { name: 'Copper Bar' });
    expect(answerItemSearch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/items?q=copper', expect.anything());
    expect(screen.queryByRole('option', { name: /Crate|Mold/ })).toBeNull();
    await user.click(option);
    expect(within(itemArticle(2)).queryByText('II')).toBeNull();
    expect(itemArticle(2).querySelector('img')).toHaveAttribute('src', COPPER_BAR.icon);
    await user.type(within(itemArticle(2)).getByLabelText('Quantity'), '3');
    expect(within(list()).getByText('Copper Bar')).toBeInTheDocument();
  });

  it('unlinks an item when its name is edited', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await linkCopperBar(user, 2);
    const name = within(itemArticle(2)).getByRole('combobox', { name: 'Item name' });
    await user.type(name, 's');
    expect(name).toHaveValue('Copper Bars');
    expect(within(itemArticle(2)).getByText('II')).toBeInTheDocument();
  });

  it('shows a discreet line when ForeverDB cannot be reached, and hides it after a success', async () => {
    answerItemSearch.mockRejectedValueOnce(new TypeError('offline'));
    const { user } = await renderApp();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const name = within(itemArticle(2)).getByRole('combobox', { name: 'Item name' });
    await user.type(name, 'copper');
    expect(
      await screen.findByText('Lost touch with ForeverDB. Item search will try again as you type.'),
    ).toBeInTheDocument();
    await user.type(name, ' bar');
    await screen.findByRole('option', { name: 'Copper Bar' });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('rolls copper up into silver when the price field loses focus', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const row = itemArticle(2);
    await user.type(within(row).getByLabelText('Unit price copper'), '150');
    await user.click(within(row).getByLabelText('Quantity'));
    expect(within(row).getByLabelText('Unit price silver')).toHaveValue(1);
    expect(within(row).getByLabelText('Unit price copper')).toHaveValue(50);
  });

  it('plays the coin sound once a recipe becomes fully priced, not while a price is still being typed', async () => {
    const { user } = await renderApp();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    await user.type(screen.getByLabelText('Copper Bar price copper'), '10');
    await waitForChime();
    expect(play).not.toHaveBeenCalled();
    const tin = screen.getByLabelText('Tin Bar price copper');
    await user.type(tin, '5');
    await advance(500);
    await user.type(tin, '0');
    await advance(500);
    expect(play).not.toHaveBeenCalled();
    await advance(300);
    expect(play).toHaveBeenCalledTimes(1);
    // Retyping a price on an entry that is already fully priced stays silent.
    await user.clear(tin);
    await user.type(tin, '7');
    await waitForChime();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('plays the coin sound once an item row becomes fully priced', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const row = itemArticle(2);
    await user.type(within(row).getByRole('combobox', { name: 'Item name' }), 'Linen Cloth');
    await advance(300);
    await user.type(within(row).getByLabelText('Quantity'), '2');
    await user.type(within(row).getByLabelText('Unit price copper'), '25');
    await waitForChime();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('stays silent when muted', async () => {
    const { user } = await renderApp();
    const mute = screen.getByRole('button', { name: 'Mute sound' });
    expect(mute).toHaveAttribute('aria-pressed', 'false');
    await user.click(mute);
    expect(mute).toHaveAttribute('aria-pressed', 'true');
    await pickRecipe(user, 1, 'rough copper', /Rough Copper Vest/);
    await user.type(screen.getByLabelText('Copper Bar price copper'), '10');
    await waitForChime();
    expect(play).not.toHaveBeenCalled();
  });

  it('removes entries and always keeps one empty recipe field', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.click(screen.getByRole('button', { name: 'Remove recipe 1' }));
    expect(articleNames()).toEqual(['Item 1']);
    await user.click(screen.getByRole('button', { name: 'Remove item 1' }));
    expect(articleNames()).toEqual(['Recipe 1']);
  });

  it('erases the page after confirmation', async () => {
    const { user, list } = await renderApp();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.click(screen.getByRole('button', { name: 'Erase the page' }));
    expect(screen.getByRole('group', { name: 'Clear every recipe and item?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Yes, erase' }));
    expect(articleNames()).toEqual(['Recipe 1']);
    expect(within(recipeArticle(1)).getByRole('combobox', { name: 'Recipe' })).toHaveValue('');
    expect(within(list()).getByText('Nothing to buy yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erase the page' })).toHaveFocus();
  });

  it('keeps recipes, prices and mute after a reload, without replaying the sound', async () => {
    const first = await renderApp();
    await pickRecipe(first.user, 1, 'smelt', /Smelt Bronze/);
    await first.user.type(screen.getByLabelText('Copper Bar price copper'), '10');
    await first.user.type(screen.getByLabelText('Tin Bar price copper'), '5');
    await waitForChime();
    expect(play).toHaveBeenCalledTimes(1);
    await first.user.click(screen.getByRole('button', { name: 'Mute sound' }));
    first.unmount();

    await renderApp();
    await waitForChime();
    expect(within(recipeArticle(1)).getByRole('combobox', { name: 'Recipe' })).toHaveValue('Smelt Bronze');
    expect(screen.getByLabelText('Copper Bar price copper')).toHaveValue(10);
    expect(screen.getByLabelText('Tin Bar price copper')).toHaveValue(5);
    expect(screen.getByRole('button', { name: 'Mute sound' })).toHaveAttribute('aria-pressed', 'true');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('discards data saved by the previous version', async () => {
    localStorage.setItem(
      'crafting-calculator:v1',
      JSON.stringify({
        version: 1,
        title: 'Old',
        cards: [{ id: 'a', name: 'Copper Bar', quantity: 2, price: { gold: 0, silver: 0, copper: 25 } }],
        muted: false,
      }),
    );
    await renderApp();
    expect(articleNames()).toEqual(['Recipe 1']);
    expect(localStorage.getItem('crafting-calculator:v1')).toBeNull();
  });
});

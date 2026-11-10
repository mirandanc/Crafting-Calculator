import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { App } from '@/App';
import recipesUrl from '@/data/recipes.json?url';
import type { ForeverItem } from '@/foreverdb/itemSearch';
import type { AuctionPriceList } from '@/prices/auctionPrices';
import { loadRecipeCatalog } from '@/recipes/loadRecipeCatalog';
import { saveSheet, STORAGE_KEY } from '@/sheet/storage';
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

const AUCTION: AuctionPriceList = {
  updatedAt: '2026-11-10T16:00:00.000Z',
  house: { ruleset: 1, id: 110, name: 'Alliance Auction House' },
  prices: { '2840': 113, '3576': 250 },
};

const CONNECTION_LOST = 'Lost touch with ForeverDB. Item search will try again as you type.';
const RECIPE_BOOK_FAILED = 'The recipe book could not be opened. Recipe search is unavailable.';

const AUCTION_PRICES_FAILED = 'Failed to load auction prices';
const RECIPE_CATALOG_FAILED = 'Failed to load the recipe catalog';

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body));

const renderApp = async (): Promise<RenderedApp> => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const view = render(<App />);
  // The App asked for the catalog on mount; awaiting the same cached promise lets its answer land.
  await act(async () => {
    await loadRecipeCatalog();
  });
  // Lets the auction price answer land too.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
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

// The live region that holds the shopping list's "Total cost" label and amount.
const totalCost = (list: HTMLElement): HTMLElement => {
  const total = within(list).getByText('Total cost').parentElement;
  if (total === null) throw new Error('Total cost has no container');
  return total;
};

describe('App', () => {
  let play: MockInstance<HTMLMediaElement['play']>;
  let fetchMock: Mock<typeof fetch>;
  let answerItemSearch: Mock<() => Promise<Response>>;
  let answerRecipes: Mock<() => Promise<Response>>;
  let answerAuctionPrices: Mock<() => Promise<Response>>;
  let consoleError: MockInstance<typeof console.error>;
  /** First arguments of the console.error calls a test expects; any other error still reaches the console. */
  let expectedErrors: string[];

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // RTL's asyncWrapper (jestFakeTimersAreEnabled) only advances fake timers on its own when it
    // detects a `jest` global; Vitest's fake timers alone aren't picked up, so shim it.
    vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    answerItemSearch = vi.fn(async () => jsonResponse({ data: SEARCH_RESULTS }));
    answerRecipes = vi.fn(async () => jsonResponse(TEST_CATALOG));
    answerAuctionPrices = vi.fn(async () => new Response('', { status: 503 }));
    // Auction prices are unavailable by default, and the hook logs that failure.
    expectedErrors = [AUCTION_PRICES_FAILED];
    const originalError = console.error;
    consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'string' && expectedErrors.includes(args[0])) return;
      originalError(...args);
    });
    fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === recipesUrl) return answerRecipes();
      if (url.startsWith('/api/items?')) return answerItemSearch();
      if (url === '/api/auction-prices') return answerAuctionPrices();
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
    expect(screen.queryByText(CONNECTION_LOST)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const name = within(itemArticle(2)).getByRole('combobox', { name: 'Item name' });
    await user.type(name, 'copper');
    expect(await screen.findByText(CONNECTION_LOST)).toBeInTheDocument();
    await user.type(name, ' bar');
    await screen.findByRole('option', { name: 'Copper Bar' });
    expect(screen.queryByText(CONNECTION_LOST)).toBeNull();
  });

  it('does not search for restored item rows until they are edited', async () => {
    saveSheet({
      entries: [{ kind: 'item', id: 'linen', name: 'Linen Cloth', itemId: null, icon: null, quantity: 2 }],
      prices: {},
      muted: false,
    });
    answerItemSearch.mockRejectedValue(new TypeError('offline'));
    const { user } = await renderApp();
    await advance(1000);
    expect(answerItemSearch).not.toHaveBeenCalled();
    expect(screen.queryByText(CONNECTION_LOST)).toBeNull();
    await user.type(within(itemArticle(1)).getByRole('combobox', { name: 'Item name' }), 's');
    await advance(300);
    expect(fetchMock).toHaveBeenCalledWith('/api/items?q=Linen%20Cloths', expect.anything());
    expect(screen.getByText(CONNECTION_LOST)).toBeInTheDocument();
  });

  it('says when the recipe book cannot be opened, and stays quiet while it loads', async () => {
    let failCatalog: () => void = () => undefined;
    expectedErrors.push(RECIPE_CATALOG_FAILED);
    answerRecipes.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          failCatalog = () => resolve(new Response('missing', { status: 500 }));
        }),
    );
    // A fresh module graph: the catalog the other tests loaded is cached per module instance.
    vi.resetModules();
    const fresh = await import('@/App');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<fresh.App />);
    await user.type(within(recipeArticle(1)).getByRole('combobox', { name: 'Recipe' }), 'smelt');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.queryByText(RECIPE_BOOK_FAILED)).toBeNull();
    failCatalog();
    expect(await screen.findByText(RECIPE_BOOK_FAILED)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(RECIPE_CATALOG_FAILED, expect.anything());
  });

  it('rolls copper up into silver when the price field loses focus', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const row = itemArticle(2);
    await user.type(within(row).getByRole('combobox', { name: 'Item name' }), 'Linen Cloth');
    await advance(300);
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

  it('never prices an item row that has no name', async () => {
    saveSheet({
      entries: [{ kind: 'item', id: 'blank', name: '', itemId: null, icon: null, quantity: null }],
      prices: { 'name:': { gold: 0, silver: 0, copper: 50 } },
      muted: false,
    });
    const { user } = await renderApp();
    const restored = within(itemArticle(1)).getByLabelText('Unit price copper');
    expect(restored).toHaveValue(null);
    expect(restored).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const row = itemArticle(2);
    expect(within(row).getByLabelText('Unit price copper')).toHaveValue(null);
    expect(within(row).getByLabelText('Unit price copper')).toBeDisabled();
    await user.type(within(row).getByRole('combobox', { name: 'Item name' }), 'Linen Cloth');
    await advance(300);
    expect(within(row).getByLabelText('Unit price copper')).toBeEnabled();
    expect(within(itemArticle(1)).getByLabelText('Unit price copper')).toBeDisabled();
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(stored).toMatchObject({ prices: {} });
  });

  it('moves focus to the new entry after "Add item" or "Add recipe"', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const name = within(itemArticle(2)).getByRole('combobox', { name: 'Item name' });
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('placeholder', 'Search an item');
    // A space typed next lands in the new field instead of pressing the button again.
    await user.keyboard(' ');
    expect(articleNames()).toEqual(['Recipe 1', 'Item 2']);
    await user.click(screen.getByRole('button', { name: 'Add recipe' }));
    expect(within(recipeArticle(3)).getByRole('combobox', { name: 'Recipe' })).toHaveFocus();
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

  it('fills reagent prices from the auction house without chiming, and says how fresh they are', async () => {
    vi.setSystemTime(new Date('2026-11-10T21:00:00Z'));
    answerAuctionPrices.mockImplementation(async () => jsonResponse(AUCTION));
    const { user, list } = await renderApp();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    expect(screen.getByLabelText('Copper Bar price silver')).toHaveValue(1);
    expect(screen.getByLabelText('Copper Bar price copper')).toHaveValue(13);
    expect(screen.getByLabelText('Tin Bar price silver')).toHaveValue(2);
    expect(within(list()).queryByText(/unpriced/)).toBeNull();
    expect(within(totalCost(list())).getByText('3s 63c')).toBeInTheDocument();
    await waitForChime();
    expect(play).not.toHaveBeenCalled();
    expect(screen.getByText('Auction prices updated 5 h ago · US Alliance')).toBeInTheDocument();
  });

  it('lets a typed price win and brings the auction price back with ↺', async () => {
    answerAuctionPrices.mockImplementation(async () => jsonResponse(AUCTION));
    const { user, list } = await renderApp();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    const copper = screen.getByLabelText('Copper Bar price copper');
    await user.clear(copper);
    await user.clear(screen.getByLabelText('Copper Bar price silver'));
    await user.type(copper, '90');
    await user.tab();
    expect(copper).toHaveValue(90);
    expect(within(totalCost(list())).getByText('3s 40c')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use the auction price for Copper Bar (1s 13c)' }));
    expect(screen.getByLabelText('Copper Bar price silver')).toHaveValue(1);
    expect(copper).toHaveValue(13);
    expect(screen.queryByRole('button', { name: /Use the auction price/ })).toBeNull();
    expect(within(totalCost(list())).getByText('3s 63c')).toBeInTheDocument();
  });

  it('warns when the auction prices are days old', async () => {
    vi.setSystemTime(new Date('2026-11-13T17:00:00Z'));
    answerAuctionPrices.mockImplementation(async () => jsonResponse(AUCTION));
    await renderApp();
    expect(screen.getByText('Auction prices are 3 days old · US Alliance')).toHaveAttribute('data-stale', 'true');
  });

  it('turns the status stale on its own while the tab sits idle', async () => {
    // 30 s short of two days old.
    vi.setSystemTime(new Date('2026-11-12T15:59:30Z'));
    answerAuctionPrices.mockImplementation(async () => jsonResponse(AUCTION));
    await renderApp();
    expect(screen.getByText('Auction prices updated 47 h ago · US Alliance')).not.toHaveAttribute('data-stale');
    await advance(60_000);
    expect(screen.getByText('Auction prices are 2 days old · US Alliance')).toHaveAttribute('data-stale', 'true');
  });

  it('tags a linked item that is not on the auction house', async () => {
    answerAuctionPrices.mockImplementation(async () => jsonResponse({ ...AUCTION, prices: { '3576': 250 } }));
    const { user } = await renderApp();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    const copperBar = screen.getByRole('listitem', { name: 'Copper Bar' });
    expect(within(copperBar).getByText('Not on AH')).toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: 'Tin Bar' })).queryByText('Not on AH')).toBeNull();
  });

  it('says when auction prices are unavailable and keeps typed pricing working', async () => {
    const { user } = await renderApp();
    expect(screen.getByText('Auction prices unavailable')).toBeInTheDocument();
    await pickRecipe(user, 1, 'smelt', /Smelt Bronze/);
    expect(screen.getByLabelText('Copper Bar price copper')).toHaveValue(null);
  });
});

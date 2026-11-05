import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { App } from '@/App';

const renderApp = () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const { unmount } = render(<App />);
  return { user, invoice: screen.getByRole('region', { name: 'Invoice' }), unmount };
};

const fillFirstCard = async (user: ReturnType<typeof userEvent.setup>, name: string, quantity: string, copper: string) => {
  const card = screen.getByRole('article', { name: 'Item 1' });
  await user.type(within(card).getByLabelText('Item name'), name);
  await user.type(within(card).getByLabelText('Quantity'), quantity);
  await user.type(within(card).getByLabelText('Unit price copper'), copper);
};

const waitForCommit = () =>
  act(() => {
    vi.advanceTimersByTime(800);
  });

describe('App', () => {
  let play: MockInstance<HTMLMediaElement['play']>;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // RTL's asyncWrapper (jestFakeTimersAreEnabled) only advances fake timers on its own when it
    // detects a `jest` global; Vitest's fake timers alone aren't picked up, so shim it.
    vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts with one empty card and a blank invoice', () => {
    const { invoice } = renderApp();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(within(invoice).queryByRole('listitem')).toBeNull();
  });

  it('shows the tally placeholders until a row is committed', async () => {
    const { user, invoice } = renderApp();
    expect(within(invoice).getByRole('heading', { name: 'Unnamed recipe' })).toBeInTheDocument();
    expect(within(invoice).getByText('Nothing tallied yet.')).toBeInTheDocument();

    await fillFirstCard(user, 'Copper Bar', '2', '25');
    await waitForCommit();

    expect(within(invoice).queryByText('Nothing tallied yet.')).toBeNull();
  });

  it('adds a filled card to the invoice after the delay and plays the coin sound', async () => {
    const { user, invoice } = renderApp();
    await fillFirstCard(user, 'Copper Bar', '2', '25');
    expect(within(invoice).queryByText('Copper Bar')).toBeNull();

    await waitForCommit();

    expect(within(invoice).getByText('Copper Bar')).toBeInTheDocument();
    expect(within(invoice).getByText('2 × 25c')).toBeInTheDocument();
    expect(within(invoice).getByText('= 50c')).toBeInTheDocument();
    expect(within(invoice).getByText('50c')).toBeInTheDocument();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('updates an existing row without playing the sound again', async () => {
    const { user, invoice } = renderApp();
    await fillFirstCard(user, 'Copper Bar', '2', '25');
    await waitForCommit();

    // Append a digit (2 → 20) instead of clearing: clearing would make the card incomplete,
    // drop the row, and re-add it with a sound — that path is covered by the hook tests.
    const quantity = within(screen.getByRole('article', { name: 'Item 1' })).getByLabelText('Quantity');
    await user.type(quantity, '0');
    await waitForCommit();

    expect(within(invoice).getByText('20 × 25c')).toBeInTheDocument();
    expect(within(invoice).getByText('5s')).toBeInTheDocument();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('rolls copper up into silver when the price field loses focus', async () => {
    const { user } = renderApp();
    const card = screen.getByRole('article', { name: 'Item 1' });
    await user.type(within(card).getByLabelText('Unit price copper'), '150');
    await user.click(within(card).getByLabelText('Item name'));

    expect(within(card).getByLabelText('Unit price silver')).toHaveValue(1);
    expect(within(card).getByLabelText('Unit price copper')).toHaveValue(50);
  });

  it('stays silent when muted', async () => {
    const { user, invoice } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Mute sound' }));
    await fillFirstCard(user, 'Copper Bar', '2', '25');
    await waitForCommit();

    expect(within(invoice).getByText('Copper Bar')).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
  });

  it('clears everything after confirmation', async () => {
    const { user, invoice } = renderApp();
    await fillFirstCard(user, 'Copper Bar', '2', '25');
    await waitForCommit();

    await user.click(screen.getByRole('button', { name: 'Clear the page' }));
    await user.click(screen.getByRole('button', { name: 'Yes, clear' }));

    expect(within(invoice).queryByText('Copper Bar')).toBeNull();
    expect(within(screen.getByRole('article', { name: 'Item 1' })).getByLabelText('Item name')).toHaveValue('');
  });

  it('keeps the recipe after a reload', async () => {
    const { user, unmount } = renderApp();
    await user.type(screen.getByLabelText('Recipe name'), 'Flask of the Titans');
    await user.click(screen.getByRole('button', { name: 'Mute sound' }));
    await fillFirstCard(user, 'Copper Bar', '2', '25');
    await waitForCommit();
    unmount();

    render(<App />);
    await waitForCommit();

    const invoice = screen.getByRole('region', { name: 'Invoice' });
    expect(within(invoice).getByRole('heading', { name: 'Flask of the Titans' })).toBeInTheDocument();
    expect(within(invoice).getByText('Copper Bar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mute sound' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not replay the sound for rows restored on reload', async () => {
    const { user, unmount } = renderApp();
    await fillFirstCard(user, 'Copper Bar', '2', '25');
    await waitForCommit();
    unmount();

    render(<App />);
    await waitForCommit();

    const invoice = screen.getByRole('region', { name: 'Invoice' });
    expect(within(invoice).getByText('Copper Bar')).toBeInTheDocument();
    expect(play).toHaveBeenCalledTimes(1);
  });
});

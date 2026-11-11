import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Bookmarks } from '@/components/Bookmarks/Bookmarks';

describe('Bookmarks', () => {
  it('shows both tabs with the selected one marked and tied to the panel', () => {
    render(<Bookmarks selected="analysis" panelId="panel" onSelect={vi.fn()} />);
    const list = screen.getByRole('tab', { name: 'Market list' });
    const analysis = screen.getByRole('tab', { name: 'Market analysis' });
    expect(list).toHaveAttribute('aria-selected', 'false');
    expect(analysis).toHaveAttribute('aria-selected', 'true');
    expect(analysis).toHaveAttribute('aria-controls', 'panel');
    expect(list).toHaveAttribute('tabindex', '-1');
    expect(analysis).toHaveAttribute('tabindex', '0');
  });

  it('selects on click and with the arrow keys', async () => {
    const onSelect = vi.fn();
    render(<Bookmarks selected="list" panelId="panel" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Market analysis' }));
    expect(onSelect).toHaveBeenLastCalledWith('analysis');
    screen.getByRole('tab', { name: 'Market list' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenLastCalledWith('analysis');
    // Focus is now on "Market analysis"; ArrowLeft goes back to "Market list".
    await userEvent.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenLastCalledWith('list');
    // And wraps around from the first tab to the last.
    await userEvent.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenLastCalledWith('analysis');
  });

  it('jumps to the first tab with Home and the last with End', async () => {
    const onSelect = vi.fn();
    render(<Bookmarks selected="list" panelId="panel" onSelect={onSelect} />);
    screen.getByRole('tab', { name: 'Market list' }).focus();
    await userEvent.keyboard('{End}');
    expect(onSelect).toHaveBeenLastCalledWith('analysis');
    expect(screen.getByRole('tab', { name: 'Market analysis' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(onSelect).toHaveBeenLastCalledWith('list');
    expect(screen.getByRole('tab', { name: 'Market list' })).toHaveFocus();
  });
});

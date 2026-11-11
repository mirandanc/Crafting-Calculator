import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfessionPicker } from '@/components/ProfessionPicker/ProfessionPicker';

const PROFESSIONS: string[] = ['Alchemy', 'Mining', 'Tailoring'];

describe('ProfessionPicker', () => {
  it('summarizes the selection', () => {
    const { rerender } = render(<ProfessionPicker professions={PROFESSIONS} selected={[]} onChange={vi.fn()} />);
    expect(screen.getByText('All professions')).toBeInTheDocument();
    rerender(<ProfessionPicker professions={PROFESSIONS} selected={['Mining', 'Alchemy']} onChange={vi.fn()} />);
    expect(screen.getByText('Alchemy, Mining')).toBeInTheDocument();
    rerender(<ProfessionPicker professions={PROFESSIONS} selected={PROFESSIONS} onChange={vi.fn()} />);
    expect(screen.getByText('3 professions')).toBeInTheDocument();
  });

  it('toggles professions, keeping the list order, and clears them', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProfessionPicker professions={PROFESSIONS} selected={['Tailoring']} onChange={onChange} />);
    await userEvent.click(screen.getByText('Professions'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Alchemy' }));
    expect(onChange).toHaveBeenLastCalledWith(['Alchemy', 'Tailoring']);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tailoring' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    rerender(<ProfessionPicker professions={PROFESSIONS} selected={['Mining']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear, show all professions' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('closes on Escape and hands focus back to the summary', async () => {
    const { container } = render(<ProfessionPicker professions={PROFESSIONS} selected={[]} onChange={vi.fn()} />);
    const details = container.querySelector('details');
    await userEvent.click(screen.getByText('Professions'));
    expect(details).toHaveAttribute('open');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mining' }));
    await userEvent.keyboard('{Escape}');
    expect(details).not.toHaveAttribute('open');
    expect(container.querySelector('summary')).toHaveFocus();
  });

  it('is disabled until the professions are known', () => {
    render(<ProfessionPicker professions={[]} selected={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Professions' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('closes when pressed outside the menu, but not inside it', async () => {
    const { container } = render(
      <>
        <ProfessionPicker professions={PROFESSIONS} selected={[]} onChange={vi.fn()} />
        <p>Elsewhere</p>
      </>,
    );
    const details = container.querySelector('details');
    await userEvent.click(screen.getByText('Professions'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mining' }));
    expect(details).toHaveAttribute('open');
    await userEvent.click(screen.getByText('Elsewhere'));
    expect(details).not.toHaveAttribute('open');
  });

  it('shows each profession with its icon', async () => {
    const { container } = render(<ProfessionPicker professions={[...PROFESSIONS, 'Unknown Craft']} selected={[]} onChange={vi.fn()} />);
    await userEvent.click(screen.getByText('Professions'));
    const icons = [...container.querySelectorAll('label img')].map((img) => img.getAttribute('src'));
    expect(icons).toEqual([
      'https://foreverdb.net/icons/136240.webp',
      'https://foreverdb.net/icons/136248.webp',
      'https://foreverdb.net/icons/136249.webp',
    ]);
  });
});

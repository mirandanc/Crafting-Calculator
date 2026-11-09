import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Autocomplete, type SearchOption } from '@/components/Autocomplete/Autocomplete';

type HarnessProps = {
  onSelect: (option: SearchOption) => void;
};

const OPTIONS: SearchOption[] = [
  { key: '1', label: 'Copper Bar', detail: null, icon: null },
  { key: '2', label: 'Copper Ore', detail: 'Mining', icon: 'https://foreverdb.net/icons/134566.webp' },
];

function Harness({ onSelect }: HarnessProps) {
  const [value, setValue] = useState('');
  return (
    <>
      <Autocomplete
        label="Item name"
        value={value}
        placeholder="Reagent"
        options={value.trim().length >= 3 ? OPTIONS : []}
        inputClassName=""
        onInputChange={setValue}
        onSelect={(option) => {
          setValue(option.label);
          onSelect(option);
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

const setup = () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<Harness onSelect={onSelect} />);
  return { user, onSelect, input: screen.getByRole('combobox', { name: 'Item name' }) };
};

describe('Autocomplete', () => {
  it('starts closed', () => {
    const { input } = setup();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens with suggestions while typing', async () => {
    const { user, input } = setup();
    await user.type(input, 'cop');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Item name suggestions' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('moves through the options with the arrow keys, wrapping around', async () => {
    const { user, input } = setup();
    await user.type(input, 'cop');
    const [first, second] = screen.getAllByRole('option');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', second.id);
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', second.id);
  });

  it('picks the active option with Enter and closes', async () => {
    const { user, input, onSelect } = setup();
    await user.type(input, 'cop');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
    expect(input).toHaveValue('Copper Bar');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('ignores Enter when no option is active', async () => {
    const { user, input, onSelect } = setup();
    await user.type(input, 'cop');
    await user.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes with Escape without picking', async () => {
    const { user, input, onSelect } = setup();
    await user.type(input, 'cop');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('cop');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('picks an option with the mouse and keeps focus in the input', async () => {
    const { user, input, onSelect } = setup();
    await user.type(input, 'cop');
    await user.click(screen.getByRole('option', { name: /Copper Ore/ }));
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1]);
    expect(input).toHaveFocus();
  });

  it('closes when focus leaves', async () => {
    const { user, input } = setup();
    await user.type(input, 'cop');
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });
});

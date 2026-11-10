import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RemoveButton } from '@/components/RemoveButton/RemoveButton';

describe('RemoveButton', () => {
  it('is a labelled button that calls back on click', async () => {
    const onClick = vi.fn();
    render(<RemoveButton label="Remove item 2" size="normal" onClick={onClick} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

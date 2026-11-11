import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EntryNumeral } from '@/components/EntryNumeral/EntryNumeral';

describe('EntryNumeral', () => {
  it('writes the position as a Roman numeral', () => {
    const { container } = render(<EntryNumeral position={4} icon={null} item={null} />);
    expect(container.textContent).toBe('IV');
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the icon instead once the entry is linked', () => {
    const { container } = render(
      <EntryNumeral position={4} icon="https://foreverdb.net/icons/133216.webp" item={{ itemId: 2840, name: 'Copper Bar' }} />,
    );
    expect(container.textContent).toBe('');
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://foreverdb.net/icons/133216.webp');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});

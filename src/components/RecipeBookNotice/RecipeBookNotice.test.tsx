import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecipeBookNotice } from '@/components/RecipeBookNotice/RecipeBookNotice';

describe('RecipeBookNotice', () => {
  it('says the recipe book could not be opened', () => {
    render(<RecipeBookNotice failed />);
    expect(screen.getByRole('status')).toHaveTextContent('The recipe book could not be opened. Recipe search is unavailable.');
  });

  it('stays mounted but empty while the recipe book loads or once it is open', () => {
    render(<RecipeBookNotice failed={false} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

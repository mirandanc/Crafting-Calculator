import { describe, expect, it } from 'vitest';
import { fromCopper, GOLD_CAP_COPPER } from '@/money/money';
import {
  createDefaultRecipe,
  createEmptyCard,
  invoiceTotal,
  isCardFilled,
  lineTotal,
  MAX_QUANTITY,
  parseQuantity,
  withoutCard,
  type ItemCard,
} from '@/recipe/recipe';

const card = (overrides: Partial<ItemCard> = {}): ItemCard => ({
  id: 'a',
  name: 'Copper Bar',
  quantity: 2,
  price: { gold: 0, silver: 0, copper: 25 },
  ...overrides,
});

describe('parseQuantity', () => {
  it('returns null for empty or non-numeric input', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('  ')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
  });

  it('truncates and clamps to 0..9999', () => {
    expect(parseQuantity('3.7')).toBe(3);
    expect(parseQuantity('-2')).toBe(0);
    expect(parseQuantity('20000')).toBe(9_999);
  });
});

describe('isCardFilled', () => {
  it('is true with a name, quantity >= 1 and price > 0', () => {
    expect(isCardFilled(card())).toBe(true);
  });

  it('is false with a blank name', () => {
    expect(isCardFilled(card({ name: '   ' }))).toBe(false);
  });

  it('is false with a missing or zero quantity', () => {
    expect(isCardFilled(card({ quantity: null }))).toBe(false);
    expect(isCardFilled(card({ quantity: 0 }))).toBe(false);
  });

  it('is false with a zero price', () => {
    expect(isCardFilled(card({ price: { gold: 0, silver: 0, copper: 0 } }))).toBe(false);
  });
});

describe('totals', () => {
  it('multiplies quantity by unit price', () => {
    expect(lineTotal(card())).toBe(50);
  });

  it('sums line totals', () => {
    const linen = card({ id: 'b', name: 'Linen Cloth', quantity: 1, price: { gold: 0, silver: 0, copper: 75 } });
    expect(invoiceTotal([card(), linen])).toBe(125);
  });

  it('clamps the invoice total at Number.MAX_SAFE_INTEGER', () => {
    const cards = Array.from({ length: 10 }, (_, index) =>
      card({ id: `card-${index}`, quantity: MAX_QUANTITY, price: fromCopper(GOLD_CAP_COPPER) }),
    );
    expect(invoiceTotal(cards)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('withoutCard', () => {
  it('removes the card with the given id', () => {
    const other = card({ id: 'b' });
    expect(withoutCard([card(), other], 'a')).toEqual([other]);
  });

  it('leaves one fresh empty card when the last card is removed', () => {
    const [remaining] = withoutCard([card()], 'a');
    expect(remaining.id).not.toBe('a');
    expect(isCardFilled(remaining)).toBe(false);
    expect(remaining.name).toBe('');
  });
});

describe('factories', () => {
  it('creates empty cards with unique ids', () => {
    expect(createEmptyCard().id).not.toBe(createEmptyCard().id);
  });

  it('creates a default recipe with one empty card, no title, sound on', () => {
    const recipe = createDefaultRecipe();
    expect(recipe.title).toBe('');
    expect(recipe.cards).toHaveLength(1);
    expect(recipe.muted).toBe(false);
  });
});

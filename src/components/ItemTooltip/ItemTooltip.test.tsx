import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemIcon } from '@/components/ItemIcon/ItemIcon';
import { ItemTooltipProvider, type TooltipItem } from '@/components/ItemTooltip/ItemTooltipProvider';
import { clearItemDetailCache } from '@/foreverdb/itemDetail';

const harnessBody = {
  data: {
    id: 276998,
    name: 'Cloudy Gustwoven Harness',
    quality: 'Uncommon',
    qualityId: 2,
    itemLevel: 12,
    requiredLevel: 7,
    classId: 4,
    class: 'Armor',
    subclassId: 2,
    subclass: 'Leather',
    inventoryTypeId: 5,
    inventoryType: 'Chest',
    icon: 'https://foreverdb.net/icons/7731374.webp',
    stats: [{ statId: 4, stat: 'Strength', value: 2 }],
    damage: null,
    speed: null,
    bonding: 'Binds when equipped',
    sellPrice: null,
    unique: false,
    effects: [],
  },
};

const gladiusBody = {
  data: {
    id: 2488,
    name: 'Gladius',
    qualityId: 1,
    itemLevel: 9,
    requiredLevel: 4,
    classId: 2,
    class: 'Weapon',
    subclass: 'Sword',
    inventoryTypeId: 13,
    inventoryType: 'One-Hand',
    stats: [],
    damage: { min: 5, max: 11, school: 'Physical' },
    speed: 2.1,
    bonding: null,
    sellPrice: 107,
    unique: false,
    effects: [],
  },
};

const HARNESS: TooltipItem = { itemId: 276998, name: 'Cloudy Gustwoven Harness' };
const GLADIUS: TooltipItem = { itemId: 2488, name: 'Gladius' };

function stubFetch(response: Promise<Response>) {
  const fetchMock = vi.fn(() => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body)));
}

function renderCard(item: TooltipItem, onCardClick = vi.fn()) {
  const view = render(
    <ItemTooltipProvider>
      <button type="button" onClick={onCardClick}>
        <ItemIcon src="x.webp" size="row" item={item} />
      </button>
      <p>Elsewhere</p>
    </ItemTooltipProvider>,
  );
  return { ...view, onCardClick };
}

function clickIcon(container: HTMLElement) {
  const icon = container.querySelector('img');
  if (icon === null) throw new Error('no icon');
  fireEvent.click(icon);
}

describe('ItemTooltip', () => {
  afterEach(() => {
    clearItemDetailCache();
    vi.unstubAllGlobals();
  });

  it('opens on an icon click with the item details, without clicking the card underneath', async () => {
    stubFetch(jsonResponse(harnessBody));
    const { container, onCardClick } = renderCard(HARNESS);

    clickIcon(container);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Cloudy Gustwoven Harness');
    expect(await screen.findByText('Item Level 12')).toBeInTheDocument();
    expect(screen.getByText('Binds when equipped')).toBeInTheDocument();
    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.getByText('Leather')).toBeInTheDocument();
    expect(screen.getByText('+2 Strength')).toBeInTheDocument();
    expect(screen.getByText('Requires Level 7')).toBeInTheDocument();
    expect(screen.queryByText(/Sell Price/)).not.toBeInTheDocument();
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('shows the name and a loading line while the details are on their way', () => {
    stubFetch(new Promise<Response>(() => {}));
    const { container } = renderCard(HARNESS);

    clickIcon(container);

    expect(screen.getByRole('tooltip')).toHaveTextContent('Cloudy Gustwoven Harness');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows only the name when the details fail to load', async () => {
    stubFetch(Promise.resolve(new Response('', { status: 502 })));
    const { container } = renderCard(HARNESS);

    clickIcon(container);

    await vi.waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
    expect(screen.getByRole('tooltip').textContent).toBe('Cloudy Gustwoven Harness');
  });

  it('closes on Escape', () => {
    stubFetch(jsonResponse(harnessBody));
    const { container } = renderCard(HARNESS);
    clickIcon(container);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes on a press elsewhere', () => {
    stubFetch(jsonResponse(harnessBody));
    const { container } = renderCard(HARNESS);
    clickIcon(container);

    fireEvent.pointerDown(screen.getByText('Elsewhere'));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows a weapon damage, speed, dps and sell price', async () => {
    stubFetch(jsonResponse(gladiusBody));
    const { container } = renderCard(GLADIUS);

    clickIcon(container);

    expect(await screen.findByText('5 - 11 Damage')).toBeInTheDocument();
    expect(screen.getByText('Speed 2.10')).toBeInTheDocument();
    expect(screen.getByText('(3.8 damage per second)')).toBeInTheDocument();
    expect(screen.getByText(/Sell Price:/)).toBeInTheDocument();
    expect(screen.getByText('1s 7c')).toHaveClass('sr-only');
  });

  it('keeps the icon a plain picture outside a provider', () => {
    const { container } = render(<ItemIcon src="x.webp" size="row" item={HARNESS} />);
    expect(container.querySelector('img')?.parentElement).toBe(container);
  });
});

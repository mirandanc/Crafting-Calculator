// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearItemDetailCache,
  damageLine,
  dpsLine,
  effectLine,
  fetchItemDetail,
  loadItemDetail,
  parseItemDetail,
  slotLine,
  speedText,
  statLine,
  type ItemDetail,
} from '@/foreverdb/itemDetail';

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

const potionBody = {
  data: {
    id: 13444,
    name: 'Major Mana Potion',
    qualityId: 1,
    itemLevel: 59,
    requiredLevel: 49,
    classId: 0,
    class: 'Consumable',
    subclass: 'Potions',
    inventoryTypeId: 0,
    inventoryType: 'Non-equippable',
    stats: [],
    damage: null,
    speed: null,
    bonding: null,
    sellPrice: 1500,
    unique: false,
    effects: [{ trigger: 'use', triggerId: 0, spellId: 17531, text: 'Restores 1350 to 2250 mana.' }],
  },
};

const patternBody = {
  data: {
    id: 276934,
    name: 'Pattern: Cloudy Gustwoven Harness',
    qualityId: 2,
    itemLevel: 1,
    requiredLevel: 0,
    classId: 9,
    class: 'Recipe',
    subclass: 'Leatherworking',
    inventoryTypeId: 0,
    inventoryType: 'Non-equippable',
    bonding: 'Binds when picked up',
    sellPrice: 312,
    effects: [{ trigger: 'use', triggerId: 0, spellId: 402265, text: '' }],
  },
};

describe('parseItemDetail', () => {
  it('parses the harness sample', () => {
    const detail = parseItemDetail(harnessBody);
    expect(detail).toEqual({
      id: 276998,
      name: 'Cloudy Gustwoven Harness',
      qualityId: 2,
      itemLevel: 12,
      requiredLevel: 7,
      classId: 4,
      subclass: 'Leather',
      inventoryTypeId: 5,
      inventoryType: 'Chest',
      bonding: 'Binds when equipped',
      unique: false,
      stats: [{ stat: 'Strength', value: 2 }],
      damage: null,
      speed: null,
      effects: [],
      sellPrice: null,
    });
  });

  it('parses the Gladius sample (damage, speed, sellPrice)', () => {
    const detail = parseItemDetail(gladiusBody);
    expect(detail.damage).toEqual({ min: 5, max: 11, school: 'Physical' });
    expect(detail.speed).toBe(2.1);
    expect(detail.sellPrice).toBe(107);
  });

  it('keeps an effect with text', () => {
    const detail = parseItemDetail(potionBody);
    expect(detail.effects).toEqual([{ trigger: 'use', text: 'Restores 1350 to 2250 mana.' }]);
  });

  it('drops an effect with empty text', () => {
    const detail = parseItemDetail(patternBody);
    expect(detail.effects).toEqual([]);
  });

  it('falls back safely on missing/invalid optional fields', () => {
    const detail = parseItemDetail({ data: { id: 1, name: 'Thing' } });
    expect(detail).toEqual({
      id: 1,
      name: 'Thing',
      qualityId: 0,
      itemLevel: 0,
      requiredLevel: 0,
      classId: 0,
      subclass: '',
      inventoryTypeId: 0,
      inventoryType: '',
      bonding: null,
      unique: false,
      stats: [],
      damage: null,
      speed: null,
      effects: [],
      sellPrice: null,
    });
  });

  it('throws on an invalid body', () => {
    expect(() => parseItemDetail({ data: { id: 'x', name: 'Thing' } })).toThrow('Item detail: invalid response');
    expect(() => parseItemDetail({ data: { id: 1 } })).toThrow('Item detail: invalid response');
    expect(() => parseItemDetail({})).toThrow('Item detail: invalid response');
    expect(() => parseItemDetail(null)).toThrow('Item detail: invalid response');
  });
});

describe('slotLine', () => {
  it('is null when inventoryTypeId is 0', () => {
    expect(slotLine(parseItemDetail(potionBody))).toBeNull();
  });

  it('shows slot and subclass for armor', () => {
    expect(slotLine(parseItemDetail(harnessBody))).toEqual({ slot: 'Chest', type: 'Leather' });
  });

  it('shows slot and subclass for weapons', () => {
    expect(slotLine(parseItemDetail(gladiusBody))).toEqual({ slot: 'One-Hand', type: 'Sword' });
  });

  it('hides the type for armor subclass Miscellaneous', () => {
    const detail = parseItemDetail({
      data: { ...harnessBody.data, subclass: 'Miscellaneous' },
    });
    expect(slotLine(detail)).toEqual({ slot: 'Chest', type: '' });
  });

  it('hides the type for non-weapon, non-armor classes', () => {
    const detail = parseItemDetail({
      data: { ...gladiusBody.data, classId: 9, subclass: 'Leatherworking' },
    });
    expect(slotLine(detail)).toEqual({ slot: 'One-Hand', type: '' });
  });
});

describe('damageLine', () => {
  it('shows a range for Physical damage', () => {
    expect(damageLine({ min: 5, max: 11, school: 'Physical' })).toBe('5 - 11 Damage');
  });

  it('shows the school for non-Physical damage', () => {
    expect(damageLine({ min: 5, max: 11, school: 'Fire' })).toBe('5 - 11 Fire Damage');
  });

  it('shows a single value when min equals max', () => {
    expect(damageLine({ min: 7, max: 7, school: 'Physical' })).toBe('7 Damage');
  });
});

describe('speedText', () => {
  it('formats to two decimals', () => {
    expect(speedText(2.1)).toBe('Speed 2.10');
  });
});

describe('dpsLine', () => {
  it('computes damage per second', () => {
    expect(dpsLine({ min: 5, max: 11, school: 'Physical' }, 2.1)).toBe('(3.8 damage per second)');
  });
});

describe('statLine', () => {
  it('formats a positive stat', () => {
    expect(statLine({ stat: 'Strength', value: 2 })).toBe('+2 Strength');
  });

  it('formats a negative stat', () => {
    expect(statLine({ stat: 'Agility', value: -1 })).toBe('-1 Agility');
  });
});

describe('effectLine', () => {
  it('formats a use effect', () => {
    expect(effectLine({ trigger: 'use', text: 'Restores 1350 to 2250 mana.' })).toBe(
      'Use: Restores 1350 to 2250 mana.',
    );
  });

  it('formats an equip effect', () => {
    expect(effectLine({ trigger: 'equip', text: 'Increases attack power.' })).toBe('Equip: Increases attack power.');
  });

  it('formats a chance on hit effect regardless of spacing', () => {
    expect(effectLine({ trigger: 'chance on hit', text: 'Deals extra damage.' })).toBe(
      'Chance on hit: Deals extra damage.',
    );
    expect(effectLine({ trigger: 'chanceonhit', text: 'Deals extra damage.' })).toBe(
      'Chance on hit: Deals extra damage.',
    );
    expect(effectLine({ trigger: 'hit', text: 'Deals extra damage.' })).toBe('Chance on hit: Deals extra damage.');
  });

  it('capitalises any other trigger', () => {
    expect(effectLine({ trigger: 'proc', text: 'Something happens.' })).toBe('Proc: Something happens.');
  });
});

describe('fetchItemDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches /api/items/{id} and parses the body', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(harnessBody)));
    vi.stubGlobal('fetch', fetchMock);

    const detail: ItemDetail = await fetchItemDetail(276998);

    expect(fetchMock).toHaveBeenCalledWith('/api/items/276998');
    expect(detail.name).toBe('Cloudy Gustwoven Harness');
  });

  it('throws when the Worker answers with an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })));
    await expect(fetchItemDetail(276998)).rejects.toThrow('Item detail failed: 502');
  });
});

describe('loadItemDetail', () => {
  afterEach(() => {
    clearItemDetailCache();
    vi.unstubAllGlobals();
  });

  it('fetches once for two loads of the same item', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(harnessBody)));
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([loadItemDetail(276998), loadItemDetail(276998)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('retries on the next call after a failed fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(harnessBody)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadItemDetail(276998)).rejects.toThrow('Item detail failed: 502');
    const detail = await loadItemDetail(276998);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(detail.name).toBe('Cloudy Gustwoven Harness');
  });
});

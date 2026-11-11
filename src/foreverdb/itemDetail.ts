export type ItemStat = { stat: string; value: number };
export type ItemDamage = { min: number; max: number; school: string };
export type ItemEffect = { trigger: string; text: string };

/** The fields the tooltip shows, from ForeverDB's item answer. */
export type ItemDetail = {
  id: number;
  name: string;
  /** 0 poor … 5 legendary, 6 artifact; sets the name's colour. */
  qualityId: number;
  itemLevel: number;
  requiredLevel: number;
  classId: number;
  subclass: string;
  inventoryTypeId: number;
  inventoryType: string;
  bonding: string | null;
  unique: boolean;
  stats: ItemStat[];
  damage: ItemDamage | null;
  speed: number | null;
  /** Only effects with text. */
  effects: ItemEffect[];
  /** Copper; null or 0 means it can't be sold to a vendor. */
  sellPrice: number | null;
};

const WEAPON_CLASS_ID = 2;
const ARMOR_CLASS_ID = 4;

const CHANCE_ON_HIT_TRIGGERS: string[] = ['chance on hit', 'chanceonhit', 'hit'];

/** Per-visit cache: one in-flight or settled fetch per item id, so a tooltip reopened on the same item is free. */
const DETAILS: Map<number, Promise<ItemDetail>> = new Map();

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toStats(value: unknown): ItemStat[] {
  if (!Array.isArray(value)) return [];
  const stats: ItemStat[] = [];
  for (const entry of value) {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      typeof (entry as { stat?: unknown }).stat === 'string' &&
      typeof (entry as { value?: unknown }).value === 'number'
    ) {
      stats.push({ stat: (entry as { stat: string }).stat, value: (entry as { value: number }).value });
    }
  }
  return stats;
}

function toDamage(value: unknown): ItemDamage | null {
  if (value === null || typeof value !== 'object') return null;
  const min = (value as { min?: unknown }).min;
  const max = (value as { max?: unknown }).max;
  if (typeof min !== 'number' || typeof max !== 'number') return null;
  const school = (value as { school?: unknown }).school;
  return { min, max, school: typeof school === 'string' ? school : 'Physical' };
}

function toEffects(value: unknown): ItemEffect[] {
  if (!Array.isArray(value)) return [];
  const effects: ItemEffect[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue;
    const trigger = (entry as { trigger?: unknown }).trigger;
    const text = (entry as { text?: unknown }).text;
    if (typeof trigger === 'string' && typeof text === 'string' && text.trim() !== '') {
      effects.push({ trigger, text });
    }
  }
  return effects;
}

/** Throws when `body.data` is not an object with a numeric id and string name; missing/invalid optional fields fall back safely. */
export function parseItemDetail(body: unknown): ItemDetail {
  const data = body !== null && typeof body === 'object' ? (body as { data?: unknown }).data : undefined;
  if (data === null || typeof data !== 'object') throw new Error('Item detail: invalid response');
  const id = (data as { id?: unknown }).id;
  const name = (data as { name?: unknown }).name;
  if (typeof id !== 'number' || typeof name !== 'string') throw new Error('Item detail: invalid response');

  const record = data as Record<string, unknown>;
  const bonding = record.bonding;
  const sellPrice = record.sellPrice;
  const speed = record.speed;

  return {
    id,
    name,
    qualityId: toNumber(record.qualityId),
    itemLevel: toNumber(record.itemLevel),
    requiredLevel: toNumber(record.requiredLevel),
    classId: toNumber(record.classId),
    subclass: toStringOrEmpty(record.subclass),
    inventoryTypeId: toNumber(record.inventoryTypeId),
    inventoryType: toStringOrEmpty(record.inventoryType),
    bonding: typeof bonding === 'string' ? bonding : null,
    unique: record.unique === true,
    stats: toStats(record.stats),
    damage: toDamage(record.damage),
    speed: typeof speed === 'number' ? speed : null,
    effects: toEffects(record.effects),
    sellPrice: typeof sellPrice === 'number' ? sellPrice : null,
  };
}

/** `fetch('/api/items/{id}')`, the Worker route this app already proxies for item search. */
export async function fetchItemDetail(itemId: number): Promise<ItemDetail> {
  const response = await fetch(`/api/items/${itemId}`);
  if (!response.ok) throw new Error(`Item detail failed: ${response.status}`);
  const body = await response.json();
  return parseItemDetail(body);
}

/** Loads an item's detail once per visit; a failed load is dropped from the cache so the next click retries. */
export function loadItemDetail(itemId: number): Promise<ItemDetail> {
  const cached = DETAILS.get(itemId);
  if (cached !== undefined) return cached;

  const promise = fetchItemDetail(itemId).catch((error: unknown) => {
    DETAILS.delete(itemId);
    throw error;
  });
  DETAILS.set(itemId, promise);
  return promise;
}

/** Tests only: clears the per-visit cache between cases. */
export function clearItemDetailCache(): void {
  DETAILS.clear();
}

/** Null when the item has no slot (`inventoryTypeId === 0`); `type` is the subclass only for weapons and armor, and empty for armor's "Miscellaneous" subclass. */
export function slotLine(detail: ItemDetail): { slot: string; type: string } | null {
  if (detail.inventoryTypeId === 0) return null;
  const showType =
    (detail.classId === WEAPON_CLASS_ID || detail.classId === ARMOR_CLASS_ID) &&
    detail.subclass !== 'Miscellaneous';
  return { slot: detail.inventoryType, type: showType ? detail.subclass : '' };
}

export function damageLine(damage: ItemDamage): string {
  const range = damage.min === damage.max ? `${damage.min}` : `${damage.min} - ${damage.max}`;
  const school = damage.school === 'Physical' ? '' : `${damage.school} `;
  return `${range} ${school}Damage`;
}

export function speedText(speed: number): string {
  return `Speed ${speed.toFixed(2)}`;
}

export function dpsLine(damage: ItemDamage, speed: number): string {
  const dps = ((damage.min + damage.max) / 2 / speed).toFixed(1);
  return `(${dps} damage per second)`;
}

export function statLine(stat: ItemStat): string {
  const sign = stat.value >= 0 ? '+' : '';
  return `${sign}${stat.value} ${stat.stat}`;
}

export function effectLine(effect: ItemEffect): string {
  const trigger = effect.trigger.toLowerCase();
  if (trigger === 'use') return `Use: ${effect.text}`;
  if (trigger === 'equip') return `Equip: ${effect.text}`;
  if (CHANCE_ON_HIT_TRIGGERS.includes(trigger)) return `Chance on hit: ${effect.text}`;
  const capitalised = effect.trigger.charAt(0).toUpperCase() + effect.trigger.slice(1);
  return `${capitalised}: ${effect.text}`;
}

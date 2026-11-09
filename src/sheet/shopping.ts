import { planCrafts, reagentQuantity } from '@/sheet/crafts';
import { priceKey, unitPriceOf, type Entry, type Prices } from '@/sheet/sheet';

export type ShoppingLine = {
  key: string;
  name: string;
  icon: string | null;
  quantity: number;
  /** Copper per item; 0 means unpriced. */
  unitPrice: number;
  /** Names of the recipes that need this item, in page order, without repeats. */
  sources: string[];
};

export type ShoppingSummary = {
  lines: ShoppingLine[];
  /** Sum of priced lines only. */
  total: number;
  unpricedCount: number;
};

type Need = {
  key: string;
  name: string;
  icon: string | null;
  quantity: number;
  source: string | null;
};

function entryNeeds(entry: Entry): Need[] {
  if (entry.kind === 'item') {
    const name = entry.name.trim();
    if (name === '' || entry.quantity === null || entry.quantity < 1) return [];
    return [{ key: priceKey(name), name, icon: entry.icon, quantity: entry.quantity, source: null }];
  }
  if (entry.recipe === null) return [];
  const plan = planCrafts(entry.wanted, entry.recipe.makes);
  if (plan.crafts === 0) return [];
  const source = entry.recipe.name;
  return entry.recipe.reagents.map((reagent) => ({
    key: priceKey(reagent.name),
    name: reagent.name,
    icon: reagent.icon,
    quantity: reagentQuantity(reagent.perCraft, plan),
    source,
  }));
}

export function summarizeShopping(entries: Entry[], prices: Prices): ShoppingSummary {
  const byKey = new Map<string, ShoppingLine>();
  for (const need of entries.flatMap(entryNeeds)) {
    const line = byKey.get(need.key);
    if (line === undefined) {
      byKey.set(need.key, {
        key: need.key,
        name: need.name,
        icon: need.icon,
        quantity: need.quantity,
        unitPrice: unitPriceOf(prices, need.key),
        sources: need.source === null ? [] : [need.source],
      });
      continue;
    }
    line.quantity += need.quantity;
    // A linked member brings its icon and its correct spelling to a line started by a typed row.
    if (line.icon === null && need.icon !== null) {
      line.icon = need.icon;
      line.name = need.name;
    }
    if (need.source !== null && !line.sources.includes(need.source)) line.sources.push(need.source);
  }
  const lines = [...byKey.values()];
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return {
    lines,
    total: Math.min(total, Number.MAX_SAFE_INTEGER),
    unpricedCount: lines.filter((line) => line.unitPrice === 0).length,
  };
}

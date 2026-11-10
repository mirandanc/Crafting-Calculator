import type { CatalogProduct } from '@/recipes/catalog';

export type CraftPlan = {
  crafts: number;
  /** Items made in total; null when the recipe makes no item (casts). */
  produced: number | null;
  extra: number;
};

const NO_CRAFTS: CraftPlan = { crafts: 0, produced: null, extra: 0 };

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

/** ×N is the amount wanted: crafts = ceil(wanted / yield). Without a product, ×N counts casts. */
export function planCrafts(wanted: number | null, makes: CatalogProduct | null): CraftPlan {
  if (wanted === null || wanted < 1) return NO_CRAFTS;
  if (makes === null) return { crafts: wanted, produced: null, extra: 0 };
  const perCraft = Math.max(makes.count, 1);
  const crafts = Math.ceil(wanted / perCraft);
  const produced = crafts * perCraft;
  return { crafts, produced, extra: produced - wanted };
}

/** "6 crafts → 12 Bronze Bar (1 extra)"; only for recipes that make more than one item per craft. */
export function craftNote(plan: CraftPlan, makes: CatalogProduct | null): string | null {
  if (plan.crafts === 0 || plan.produced === null || makes === null || makes.count <= 1) return null;
  const extra = plan.extra > 0 ? ` (${plan.extra} extra)` : '';
  return `${plan.crafts} ${plural(plan.crafts, 'craft', 'crafts')} → ${plan.produced} ${makes.name}${extra}`;
}

/**
 * Deliberately uncapped: MAX_QUANTITY and MAX_WANTED only bound a single input field, but the amount
 * a reagent's quantity multiplies out to is what the player actually has to buy, however large.
 */
export function reagentQuantity(perCraft: number, plan: CraftPlan): number {
  return perCraft * plan.crafts;
}

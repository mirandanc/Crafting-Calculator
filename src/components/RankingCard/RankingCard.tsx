import { Fragment, useId } from 'react';
import { ItemIcon } from '@/components/ItemIcon/ItemIcon';
import { MoneyText } from '@/components/MoneyText/MoneyText';
import styles from '@/components/RankingCard/RankingCard.module.css';
import { formatMargin, formatSoldPerDay, type RankedRecipe } from '@/market/ranking';
import type { CatalogRecipe } from '@/recipes/catalog';

type RankingCardProps = {
  ranked: RankedRecipe;
  onAdd: (recipe: CatalogRecipe) => void;
};

/**
 * One ranked recipe; the whole card is the button that adds it to the market list.
 * A button holds only phrasing content, so the reagent list is spans with list roles,
 * and the figures are read as the button's description.
 */
export function RankingCard({ ranked, onAdd }: RankingCardProps) {
  const { recipe, reagents, revenue, cost, profit, margin, salesPerDay, profitPerDay } = ranked;
  const detailsId = useId();
  return (
    <li className={styles.item}>
      <button
        type="button"
        className={styles.card}
        aria-label={`Add ${recipe.name} to the market list`}
        aria-describedby={detailsId}
        onClick={() => onAdd(recipe)}
      >
        <span className={styles.head}>
          <ItemIcon src={recipe.icon} size="row" />
          <span className={styles.title}>
            <span className={styles.name}>{recipe.name}</span>
            <span className={styles.profession}>
              {recipe.profession}
              {salesPerDay !== null && <span className={styles.sold}> · {formatSoldPerDay(salesPerDay)}</span>}
            </span>
          </span>
          <span className={styles.margin}>{formatMargin(margin)}</span>
        </span>
        <span id={detailsId} className={styles.details}>
          <span className="sr-only">
            {salesPerDay === null
              ? `${recipe.profession}, ${formatMargin(margin)} margin.`
              : `${recipe.profession}, ${formatSoldPerDay(salesPerDay)}, ${formatMargin(margin)} margin.`}
          </span>{' '}
          <span className={styles.money}>
            <span className={styles.figure}>
              <span className={styles.label}>Profit</span>{' '}
              <MoneyText copper={profit} />
            </span>{' '}
            <span className={styles.figure}>
              <span className={styles.label}>Sells for</span>{' '}
              <MoneyText copper={revenue} />
            </span>{' '}
            <span className={styles.figure}>
              <span className={styles.label}>Costs</span>{' '}
              <MoneyText copper={cost} />
            </span>
          </span>{' '}
          {profitPerDay !== null && (
            <>
              <span className={styles.sales}>
                ≈ <MoneyText copper={profitPerDay} />/day
              </span>{' '}
            </>
          )}
          {/* The spaces between parts only matter to the description; flex and grid layouts drop them. */}
          <span role="list" className={styles.reagents}>
            {reagents.map((reagent) => (
              <Fragment key={reagent.itemId}>
                <span role="listitem" className={styles.reagent} aria-label={reagent.name}>
                  {reagent.icon === null ? <span className={styles.iconGap} aria-hidden="true" /> : <ItemIcon src={reagent.icon} size="small" />}
                  <span className={styles.reagentName}>{reagent.name}</span>{' '}
                  <span className={styles.count}>×{reagent.count}</span>{' '}
                  <MoneyText copper={reagent.unitPrice} />
                  {reagent.source === 'vendor' && (
                    <>
                      {' '}
                      <span className={styles.tag}>Vendor</span>
                    </>
                  )}
                </span>{' '}
              </Fragment>
            ))}
          </span>
        </span>
      </button>
    </li>
  );
}

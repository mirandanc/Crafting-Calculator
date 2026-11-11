import { useId, useMemo, useState } from 'react';
import styles from '@/components/MarketAnalysis/MarketAnalysis.module.css';
import { MoneyInput } from '@/components/MoneyInput/MoneyInput';
import { RankingCard } from '@/components/RankingCard/RankingCard';
import { formatSalesCoverage, rankRecipes, type RankedRecipe, type RankingSort } from '@/market/ranking';
import { formatMoney, toCopper, type Coins } from '@/money/money';
import type { AuctionPricesState } from '@/prices/auctionPrices';
import type { CatalogRecipe, RecipeCatalog } from '@/recipes/catalog';

export type MarketAnalysisProps = {
  catalog: RecipeCatalog | null;
  catalogFailed: boolean;
  auction: AuctionPricesState;
  professions: string[];
  minProfit: Coins;
  onMinProfitChange: (minProfit: Coins) => void;
  onMinProfitBlur: () => void;
  sort: RankingSort;
  onSortChange: (sort: RankingSort) => void;
  onAdd: (recipe: CatalogRecipe) => void;
};

type RankingListProps = {
  ranked: RankedRecipe[];
  onAdd: (recipe: CatalogRecipe) => void;
};

type SortOption = {
  sort: RankingSort;
  label: string;
};

type SortSwitchProps = {
  sort: RankingSort;
  onChange: (sort: RankingSort) => void;
};

const PAGE_SIZE = 25;
const SORT_OPTIONS: SortOption[] = [
  { sort: 'profitPerDay', label: 'Profit per day' },
  { sort: 'margin', label: 'Margin' },
];
const COUNTING_NOTE = 'Sales are still being counted; ranking by margin only.';

function RankingList({ ranked, onAdd }: RankingListProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  return (
    <>
      <ol className={styles.cards} aria-label="Most profitable recipes">
        {ranked.slice(0, shown).map((entry) => (
          <RankingCard key={entry.recipe.id} ranked={entry} onAdd={onAdd} />
        ))}
      </ol>
      {shown < ranked.length && (
        <button type="button" className={styles.more} onClick={() => setShown((count) => count + PAGE_SIZE)}>
          Show more
        </button>
      )}
    </>
  );
}

/** One choice of two, so native radios: arrow keys and "1 of 2, checked" come for free. */
function SortSwitch({ sort, onChange }: SortSwitchProps) {
  const captionId = useId();
  const name = useId();
  return (
    <div className={styles.sort} role="radiogroup" aria-labelledby={captionId}>
      <span id={captionId} className={styles.caption}>
        Sort by
      </span>
      {SORT_OPTIONS.map((option) => (
        <label key={option.sort} className={styles.choice}>
          <input
            type="radio"
            className={styles.radio}
            name={name}
            value={option.sort}
            checked={sort === option.sort}
            onChange={() => onChange(option.sort)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

/** The recipes most worth crafting at the current market prices; a click sends one craft to the market list. */
export function MarketAnalysis({
  catalog,
  catalogFailed,
  auction,
  professions,
  minProfit,
  onMinProfitChange,
  onMinProfitBlur,
  sort,
  onSortChange,
  onAdd,
}: MarketAnalysisProps) {
  const minCopper = toCopper(minProfit);
  const ranked = useMemo(
    () =>
      catalog === null || auction.list === null
        ? null
        : rankRecipes(
            catalog,
            {
              auction: auction.list.prices,
              quantities: auction.list.quantities ?? null,
              sales: auction.list.sales ?? null,
              salesDays: auction.list.salesDays ?? null,
              vendor: catalog.vendorPrices,
            },
            { professions, minProfit: minCopper },
            sort,
          ),
    [catalog, auction.list, professions, minCopper, sort],
  );
  const salesDays = auction.list?.salesDays;
  const salesNote = salesDays === undefined ? COUNTING_NOTE : formatSalesCoverage(salesDays);

  let body;
  if (catalogFailed) body = <p className={styles.note}>The recipe book could not be opened, so recipes can't be ranked.</p>;
  else if (auction.failed) body = <p className={styles.note}>Auction prices are unavailable, so recipes can't be ranked right now.</p>;
  else if (ranked === null) body = <p className={styles.note}>Weighing the market…</p>;
  else
    body = (
      <>
        <p className={styles.note}>{salesNote}</p>
        {ranked.length === 0 ? (
          <p className={styles.note}>No recipe makes at least {formatMoney(minCopper)} per craft right now.</p>
        ) : (
          // A new filter or sort starts the list over at the first 25.
          <RankingList key={`${professions.join('|')}:${minCopper}:${sort}`} ranked={ranked} onAdd={onAdd} />
        )}
      </>
    );

  return (
    <div className={styles.analysis}>
      <div className={styles.controls}>
        <div className={styles.minimum}>
          <MoneyInput label="Minimum profit" caption="at least" value={minProfit} onChange={onMinProfitChange} onBlur={onMinProfitBlur} />
          <span className={styles.caption}>profit per craft</span>
        </div>
        <SortSwitch sort={sort} onChange={onSortChange} />
      </div>
      {body}
    </div>
  );
}

import { useMemo, useState } from 'react';
import styles from '@/components/MarketAnalysis/MarketAnalysis.module.css';
import { MoneyInput } from '@/components/MoneyInput/MoneyInput';
import { RankingCard } from '@/components/RankingCard/RankingCard';
import { rankRecipes, type RankedRecipe } from '@/market/ranking';
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
  onAdd: (recipe: CatalogRecipe) => void;
};

type RankingListProps = {
  ranked: RankedRecipe[];
  onAdd: (recipe: CatalogRecipe) => void;
};

const PAGE_SIZE = 25;

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

/** The recipes most worth crafting at the current market prices; a click sends one craft to the market list. */
export function MarketAnalysis({
  catalog,
  catalogFailed,
  auction,
  professions,
  minProfit,
  onMinProfitChange,
  onMinProfitBlur,
  onAdd,
}: MarketAnalysisProps) {
  const minCopper = toCopper(minProfit);
  const ranked = useMemo(
    () =>
      catalog === null || auction.list === null
        ? null
        : rankRecipes(
            catalog,
            { auction: auction.list.prices, quantities: auction.list.quantities ?? null, vendor: catalog.vendorPrices },
            { professions, minProfit: minCopper },
          ),
    [catalog, auction.list, professions, minCopper],
  );

  let body;
  if (catalogFailed) body = <p className={styles.note}>The recipe book could not be opened, so recipes can't be ranked.</p>;
  else if (auction.failed) body = <p className={styles.note}>Auction prices are unavailable, so recipes can't be ranked right now.</p>;
  else if (ranked === null) body = <p className={styles.note}>Weighing the market…</p>;
  else if (ranked.length === 0) body = <p className={styles.note}>No recipe makes at least {formatMoney(minCopper)} per craft right now.</p>;
  // A new filter starts the list over at the first 25.
  else body = <RankingList key={`${professions.join('|')}:${minCopper}`} ranked={ranked} onAdd={onAdd} />;

  return (
    <div className={styles.analysis}>
      <div className={styles.minimum}>
        <MoneyInput label="Minimum profit" caption="at least" value={minProfit} onChange={onMinProfitChange} onBlur={onMinProfitBlur} />
        <span className={styles.caption}>profit per craft</span>
      </div>
      {body}
    </div>
  );
}

import { useCallback, useMemo, useState } from 'react';
import styles from '@/App.module.css';
import { Ambience } from '@/components/Ambience/Ambience';
import { ConnectionNotice } from '@/components/ConnectionNotice/ConnectionNotice';
import { EntryList } from '@/components/EntryList/EntryList';
import { Footer } from '@/components/Footer/Footer';
import { MuteToggle } from '@/components/MuteToggle/MuteToggle';
import { Page } from '@/components/Page/Page';
import { RecipeBookNotice } from '@/components/RecipeBookNotice/RecipeBookNotice';
import { Ribbon } from '@/components/Ribbon/Ribbon';
import { ShoppingList } from '@/components/ShoppingList/ShoppingList';
import { marketPricesByKey, withMarketPrices, type ItemPrices } from '@/prices/marketPrices';
import { useAuctionPrices } from '@/prices/useAuctionPrices';
import { useRecipeCatalog } from '@/recipes/useRecipeCatalog';
import { summarizeShopping } from '@/sheet/shopping';
import { useSheet } from '@/sheet/useSheet';
import { useChimeOnFullyPriced } from '@/sound/useChimeOnFullyPriced';
import { useCoinSound } from '@/sound/useCoinSound';

/** Until the auction list or the recipe book arrives (or when it fails), it adds no prices. */
const NO_ITEM_PRICES: ItemPrices = {};

export function App() {
  const { sheet, actions } = useSheet();
  const { catalog, failed: catalogFailed } = useRecipeCatalog();
  const auction = useAuctionPrices();
  const auctionPrices = auction.list?.prices ?? NO_ITEM_PRICES;
  const vendorPrices = catalog?.vendorPrices ?? NO_ITEM_PRICES;
  const marketByKey = useMemo(
    () => marketPricesByKey(sheet.entries, auctionPrices, vendorPrices),
    [sheet.entries, auctionPrices, vendorPrices],
  );
  // Typed prices win over market prices.
  const prices = useMemo(() => withMarketPrices(sheet.prices, marketByKey), [sheet.prices, marketByKey]);
  const playCoin = useCoinSound(sheet.muted);
  // Either price source arriving completes entries silently; see useChimeOnFullyPriced.
  // A recipe book without vendor prices brings no market prices, so it leaves the stamp alone.
  const vendorStamp = Object.keys(vendorPrices).length === 0 ? null : (catalog?.build ?? null);
  const marketStamp = auction.list === null && vendorStamp === null ? null : `${auction.list?.updatedAt ?? ''}|${vendorStamp ?? ''}`;
  useChimeOnFullyPriced({ entries: sheet.entries, prices, typedPrices: sheet.prices, marketStamp }, playCoin);
  const [connectionLost, setConnectionLost] = useState(false);
  const handleReachable = useCallback((reachable: boolean) => setConnectionLost(!reachable), []);
  const summary = useMemo(() => summarizeShopping(sheet.entries, prices), [sheet.entries, prices]);

  return (
    <div className={styles.page}>
      <Ambience />
      <header className={styles.header}>
        <h1 className={styles.heading}>Crafting Calculator</h1>
        <MuteToggle muted={sheet.muted} onToggle={() => actions.setMuted(!sheet.muted)} />
      </header>
      <main className={styles.book}>
        <div className={styles.stitching} aria-hidden="true" />
        <Page side="left" label="Reagents" heading="Reagents">
          <RecipeBookNotice failed={catalogFailed} />
          <ConnectionNotice lost={connectionLost} />
          <EntryList
            entries={sheet.entries}
            prices={prices}
            typedPrices={sheet.prices}
            marketByKey={marketByKey}
            auctionLoaded={auction.list !== null}
            catalog={catalog}
            actions={actions}
            onReachable={handleReachable}
          />
        </Page>
        <ShoppingList summary={summary} />
        <Ribbon />
      </main>
      <Footer auction={auction} />
    </div>
  );
}

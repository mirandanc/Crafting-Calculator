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
import { useRecipeCatalog } from '@/recipes/useRecipeCatalog';
import { summarizeShopping } from '@/sheet/shopping';
import { useSheet } from '@/sheet/useSheet';
import { useChimeOnFullyPriced } from '@/sound/useChimeOnFullyPriced';
import { useCoinSound } from '@/sound/useCoinSound';

export function App() {
  const { sheet, actions } = useSheet();
  const { catalog, failed: catalogFailed } = useRecipeCatalog();
  const playCoin = useCoinSound(sheet.muted);
  useChimeOnFullyPriced({ entries: sheet.entries, prices: sheet.prices, typedPrices: sheet.prices, auctionStamp: null }, playCoin);
  const [connectionLost, setConnectionLost] = useState(false);
  const handleReachable = useCallback((reachable: boolean) => setConnectionLost(!reachable), []);
  const summary = useMemo(() => summarizeShopping(sheet.entries, sheet.prices), [sheet.entries, sheet.prices]);

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
            prices={sheet.prices}
            typedPrices={sheet.prices}
            auctionByKey={{}}
            auctionLoaded={false}
            catalog={catalog}
            actions={actions}
            onReachable={handleReachable}
          />
        </Page>
        <ShoppingList summary={summary} />
        <Ribbon />
      </main>
      <Footer />
    </div>
  );
}

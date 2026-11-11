import { useCallback, useId, useMemo, useState } from 'react';
import styles from '@/App.module.css';
import { Ambience } from '@/components/Ambience/Ambience';
import { BOOKMARKS, bookmarkId, Bookmarks } from '@/components/Bookmarks/Bookmarks';
import { ConnectionNotice } from '@/components/ConnectionNotice/ConnectionNotice';
import { EntryList } from '@/components/EntryList/EntryList';
import { Footer } from '@/components/Footer/Footer';
import { ItemTooltipProvider } from '@/components/ItemTooltip/ItemTooltipProvider';
import { MarketAnalysis } from '@/components/MarketAnalysis/MarketAnalysis';
import { MuteToggle } from '@/components/MuteToggle/MuteToggle';
import { Page } from '@/components/Page/Page';
import { ProfessionPicker } from '@/components/ProfessionPicker/ProfessionPicker';
import { RecipeBookNotice } from '@/components/RecipeBookNotice/RecipeBookNotice';
import { Ribbon } from '@/components/Ribbon/Ribbon';
import { ShoppingList } from '@/components/ShoppingList/ShoppingList';
import type { BookTab } from '@/market/preferences';
import { usePreferences } from '@/market/usePreferences';
import { marketPricesByKey, withMarketPrices, type ItemPrices } from '@/prices/marketPrices';
import { useAuctionPrices } from '@/prices/useAuctionPrices';
import { professionsOf, type CatalogRecipe } from '@/recipes/catalog';
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
  const vendorStamp = catalog === null || Object.keys(catalog.vendorPrices).length === 0 ? null : catalog.build;
  const marketStamp = auction.list === null && vendorStamp === null ? null : `${auction.list?.updatedAt ?? ''}|${vendorStamp ?? ''}`;
  const quietNextChimeCheck = useChimeOnFullyPriced({ entries: sheet.entries, prices, typedPrices: sheet.prices, marketStamp }, playCoin);
  const [connectionLost, setConnectionLost] = useState(false);
  const handleReachable = useCallback((reachable: boolean) => setConnectionLost(!reachable), []);
  const summary = useMemo(() => summarizeShopping(sheet.entries, prices), [sheet.entries, prices]);
  const { preferences, actions: preferenceActions } = usePreferences();
  const panelId = useId();
  // The page always opens on the market analysis; the tab itself is never remembered.
  const [tab, setTab] = useState<BookTab>('analysis');
  // Only a bookmark the player picks turns the page; the first render doesn't.
  const [turned, setTurned] = useState(false);
  const selectTab = (next: BookTab) => {
    if (next === tab) return;
    setTurned(true);
    setTab(next);
  };
  const professions = useMemo(() => (catalog === null ? [] : professionsOf(catalog)), [catalog]);
  // A saved profession the recipe book no longer has is ignored; until the book loads, the saved list stands.
  const selectedProfessions = useMemo(
    () =>
      catalog === null ? preferences.professions : preferences.professions.filter((profession) => professions.includes(profession)),
    [catalog, professions, preferences.professions],
  );
  // A recipe sent from the analysis chimes straight away. Its reagents may use a price the player
  // typed earlier, so the fully-priced check that follows is told to stay quiet rather than chime again.
  const addFromAnalysis = (recipe: CatalogRecipe) => {
    if (catalog === null) return;
    quietNextChimeCheck();
    actions.addCraftedRecipe(recipe, catalog.items);
    playCoin();
  };
  const leftTitle = BOOKMARKS.find((bookmark) => bookmark.tab === tab)?.label ?? '';

  return (
    <ItemTooltipProvider>
      <div className={styles.page}>
        <Ambience />
        <header className={styles.header}>
          <h1 className={styles.heading}>Crafting Calculator</h1>
          <MuteToggle muted={sheet.muted} onToggle={() => actions.setMuted(!sheet.muted)} />
        </header>
        <main className={styles.book}>
          <Bookmarks selected={tab} panelId={panelId} onSelect={selectTab} />
          <div className={styles.stitching} aria-hidden="true" />
          <Page
            key={tab}
            id={panelId}
            role="tabpanel"
            side="left"
            labelledBy={bookmarkId(tab)}
            heading={leftTitle}
            turning={turned}
          >
            <ProfessionPicker professions={professions} selected={selectedProfessions} onChange={preferenceActions.setProfessions} />
            {tab === 'list' ? (
              <>
                <RecipeBookNotice failed={catalogFailed} />
                <ConnectionNotice lost={connectionLost} />
                <EntryList
                  entries={sheet.entries}
                  prices={prices}
                  typedPrices={sheet.prices}
                  marketByKey={marketByKey}
                  auctionLoaded={auction.list !== null}
                  catalog={catalog}
                  professions={selectedProfessions}
                  actions={actions}
                  onReachable={handleReachable}
                />
              </>
            ) : (
              <MarketAnalysis
                catalog={catalog}
                catalogFailed={catalogFailed}
                auction={auction}
                professions={selectedProfessions}
                minProfit={preferences.minProfit}
                onMinProfitChange={preferenceActions.setMinProfit}
                onMinProfitBlur={preferenceActions.normalizeMinProfit}
                sort={preferences.sort}
                onSortChange={preferenceActions.setSort}
                onAdd={addFromAnalysis}
              />
            )}
          </Page>
          <ShoppingList summary={summary} />
          <Ribbon />
        </main>
        <Footer auction={auction} />
      </div>
    </ItemTooltipProvider>
  );
}

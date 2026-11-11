import { useEffect, useId, useRef, useState } from 'react';
import styles from '@/components/EntryList/EntryList.module.css';
import { ItemRowEditor } from '@/components/ItemRowEditor/ItemRowEditor';
import { RecipeBlockEditor } from '@/components/RecipeBlockEditor/RecipeBlockEditor';
import type { Coins } from '@/money/money';
import { priceHintOf, type MarketPricesByKey, type PriceHint } from '@/prices/marketPrices';
import type { RecipeCatalog } from '@/recipes/catalog';
import { priceKey, priceOf, type Entry, type Prices } from '@/sheet/sheet';
import type { SheetActions } from '@/sheet/useSheet';

type EntryListProps = {
  entries: Entry[];
  /** The prices in effect: typed over market. */
  prices: Prices;
  /** Only the prices the player typed. */
  typedPrices: Prices;
  marketByKey: MarketPricesByKey;
  auctionLoaded: boolean;
  catalog: RecipeCatalog | null;
  /** Narrows the recipe search; empty means all. */
  professions: string[];
  actions: SheetActions;
  onReachable: (reachable: boolean) => void;
};

type FocusTarget = 'cancel' | 'erase' | null;

/** Where focus should land once the next render settles, after adding or removing an entry. */
type EntryFocusTarget = { kind: 'entry'; id: string } | { kind: 'lastEntry' } | { kind: 'addRecipe' } | null;

const NO_PRICE: Coins = { gold: 0, silver: 0, copper: 0 };
const NO_HINT: PriceHint = { kind: 'none' };

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function EntryList({ entries, prices, typedPrices, marketByKey, auctionLoaded, catalog, professions, actions, onReachable }: EntryListProps) {
  const [confirmingErase, setConfirmingErase] = useState(false);
  const questionId = useId();
  const focusTargetRef = useRef<FocusTarget>(null);
  const eraseRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const entriesRef = useRef<HTMLDivElement>(null);
  const addRecipeRef = useRef<HTMLButtonElement>(null);
  const entryFocusRef = useRef<EntryFocusTarget>(null);

  useEffect(() => {
    const target = focusTargetRef.current;
    if (target === 'cancel') {
      cancelRef.current?.focus();
    } else if (target === 'erase') {
      eraseRef.current?.focus();
    }
    focusTargetRef.current = null;
  }, [confirmingErase]);

  // Runs after every entries change, including an add or a removal: picks up the pending target (if
  // any) and focuses it once the new entry is rendered or the removed entry's DOM is actually gone.
  // A no-op when nothing is pending, so it's safe to re-run under StrictMode's double-invoked effects.
  useEffect(() => {
    const target = entryFocusRef.current;
    if (target === null) return;
    entryFocusRef.current = null;
    if (target.kind === 'addRecipe') {
      addRecipeRef.current?.focus();
      return;
    }
    const id = target.kind === 'entry' ? target.id : entries.at(-1)?.id;
    if (id === undefined) return;
    const field = entriesRef.current?.querySelector<HTMLElement>(`[data-entry-id="${id}"] input`);
    field?.focus();
  }, [entries]);

  const openConfirm = () => {
    focusTargetRef.current = 'cancel';
    setConfirmingErase(true);
  };

  const closeConfirm = () => {
    focusTargetRef.current = 'erase';
    setConfirmingErase(false);
  };

  // Focus moves into the new entry, so a space typed next doesn't press the button again.
  const addRecipe = () => {
    entryFocusRef.current = { kind: 'lastEntry' };
    actions.addRecipe();
  };

  const addItem = () => {
    entryFocusRef.current = { kind: 'lastEntry' };
    actions.addItem();
  };

  const removeEntry = (id: string) => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index !== -1 && index < entries.length - 1) {
      entryFocusRef.current = { kind: 'entry', id: entries[index + 1].id };
    } else if (index > 0) {
      entryFocusRef.current = { kind: 'entry', id: entries[index - 1].id };
    } else {
      entryFocusRef.current = { kind: 'addRecipe' };
    }
    actions.removeEntry(id);
  };

  return (
    <div className={styles.list}>
      <div className={styles.entries} ref={entriesRef}>
        {entries.map((entry, index) => {
          if (entry.kind === 'recipe') {
            return (
              <div key={entry.id} data-entry-id={entry.id} className={styles.entryWrapper}>
                <RecipeBlockEditor
                  block={entry}
                  position={index + 1}
                  catalog={catalog}
                  prices={prices}
                  typedPrices={typedPrices}
                  marketByKey={marketByKey}
                  auctionLoaded={auctionLoaded}
                  professions={professions}
                  onChoose={(recipe, items) => actions.chooseRecipe(entry.id, recipe, items)}
                  onWantedChange={(wanted) => actions.setWanted(entry.id, wanted)}
                  onRemoveReagent={(itemId) => actions.removeReagent(entry.id, itemId)}
                  onPriceChange={actions.setPrice}
                  onPriceBlur={actions.normalizePrice}
                  onRestorePrice={actions.clearPrice}
                  onRemove={() => removeEntry(entry.id)}
                />
              </div>
            );
          }
          // A nameless row has no price key: its price stays empty and is never stored under 'name:'.
          const itemKey = entry.name.trim() === '' ? null : priceKey(entry.name);
          return (
            <div key={entry.id} data-entry-id={entry.id} className={styles.entryWrapper}>
              <ItemRowEditor
                row={entry}
                position={index + 1}
                price={itemKey === null ? NO_PRICE : priceOf(prices, itemKey)}
                hint={itemKey === null ? NO_HINT : priceHintOf(itemKey, entry.itemId !== null, typedPrices, marketByKey, auctionLoaded)}
                onRename={(name) => actions.renameItem(entry.id, name)}
                onLink={(item) => actions.linkItem(entry.id, item)}
                onQuantityChange={(quantity) => actions.setItemQuantity(entry.id, quantity)}
                onPriceChange={(price) => {
                  if (itemKey !== null) actions.setPrice(itemKey, price);
                }}
                onPriceBlur={() => {
                  if (itemKey !== null) actions.normalizePrice(itemKey);
                }}
                onRestorePrice={() => {
                  if (itemKey !== null) actions.clearPrice(itemKey);
                }}
                onRemove={() => removeEntry(entry.id)}
                onReachable={onReachable}
              />
            </div>
          );
        })}
      </div>
      <div className={styles.actions}>
        <div className={styles.adds}>
          <button type="button" className={styles.stamp} ref={addRecipeRef} onClick={addRecipe}>
            <PlusIcon />
            Add recipe
          </button>
          <button type="button" className={styles.stampQuiet} onClick={addItem}>
            <PlusIcon />
            Add item
          </button>
        </div>
        {confirmingErase ? (
          <div
            className={styles.confirm}
            role="group"
            aria-labelledby={questionId}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeConfirm();
            }}
          >
            <span id={questionId} className={styles.question}>
              Clear every recipe and item?
            </span>
            <button
              type="button"
              className={styles.confirmYes}
              onClick={() => {
                actions.eraseAll();
                closeConfirm();
              }}
            >
              Yes, erase
            </button>
            <button type="button" className={styles.ghost} ref={cancelRef} onClick={closeConfirm}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className={styles.ghost} ref={eraseRef} onClick={openConfirm}>
            Erase the page
          </button>
        )}
      </div>
    </div>
  );
}

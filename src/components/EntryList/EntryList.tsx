import { useEffect, useRef, useState } from 'react';
import styles from '@/components/EntryList/EntryList.module.css';
import { ItemRowEditor } from '@/components/ItemRowEditor/ItemRowEditor';
import { RecipeBlockEditor } from '@/components/RecipeBlockEditor/RecipeBlockEditor';
import type { RecipeCatalog } from '@/recipes/catalog';
import { priceKey, priceOf, type Entry, type Prices } from '@/sheet/sheet';
import type { SheetActions } from '@/sheet/useSheet';

type EntryListProps = {
  entries: Entry[];
  prices: Prices;
  catalog: RecipeCatalog | null;
  actions: SheetActions;
  onReachable: (reachable: boolean) => void;
};

type FocusTarget = 'cancel' | 'erase' | null;

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function EntryList({ entries, prices, catalog, actions, onReachable }: EntryListProps) {
  const [confirmingErase, setConfirmingErase] = useState(false);
  const focusTargetRef = useRef<FocusTarget>(null);
  const eraseRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target = focusTargetRef.current;
    if (target === 'cancel') {
      cancelRef.current?.focus();
    } else if (target === 'erase') {
      eraseRef.current?.focus();
    }
    focusTargetRef.current = null;
  }, [confirmingErase]);

  const openConfirm = () => {
    focusTargetRef.current = 'cancel';
    setConfirmingErase(true);
  };

  const closeConfirm = () => {
    focusTargetRef.current = 'erase';
    setConfirmingErase(false);
  };

  return (
    <div className={styles.list}>
      <div className={styles.entries}>
        {entries.map((entry, index) => {
          if (entry.kind === 'recipe') {
            return (
              <RecipeBlockEditor
                key={entry.id}
                block={entry}
                position={index + 1}
                catalog={catalog}
                prices={prices}
                onChoose={(recipe, items) => actions.chooseRecipe(entry.id, recipe, items)}
                onWantedChange={(wanted) => actions.setWanted(entry.id, wanted)}
                onRemoveReagent={(itemId) => actions.removeReagent(entry.id, itemId)}
                onPriceChange={actions.setPrice}
                onPriceBlur={actions.normalizePrice}
                onRemove={() => actions.removeEntry(entry.id)}
              />
            );
          }
          const key = priceKey(entry.name);
          return (
            <ItemRowEditor
              key={entry.id}
              row={entry}
              position={index + 1}
              price={priceOf(prices, key)}
              onRename={(name) => actions.renameItem(entry.id, name)}
              onLink={(item) => actions.linkItem(entry.id, item)}
              onQuantityChange={(quantity) => actions.setItemQuantity(entry.id, quantity)}
              onPriceChange={(price) => actions.setPrice(key, price)}
              onPriceBlur={() => actions.normalizePrice(key)}
              onRemove={() => actions.removeEntry(entry.id)}
              onReachable={onReachable}
            />
          );
        })}
      </div>
      <div className={styles.actions}>
        <div className={styles.adds}>
          <button type="button" className={styles.stamp} onClick={actions.addRecipe}>
            <PlusIcon />
            Add recipe
          </button>
          <button type="button" className={styles.stampQuiet} onClick={actions.addItem}>
            <PlusIcon />
            Add item
          </button>
        </div>
        {confirmingErase ? (
          <div
            className={styles.confirm}
            role="group"
            aria-label="Confirm erase"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeConfirm();
            }}
          >
            <span className={styles.question}>Clear every recipe and item?</span>
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

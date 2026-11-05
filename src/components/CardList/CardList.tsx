import { useEffect, useRef, useState } from 'react';
import styles from '@/components/CardList/CardList.module.css';
import { ItemCardEditor } from '@/components/ItemCardEditor/ItemCardEditor';
import type { ItemCard, ItemCardPatch } from '@/recipe/recipe';

type CardListProps = {
  cards: ItemCard[];
  onAdd: () => void;
  onChange: (id: string, patch: ItemCardPatch) => void;
  onNormalizePrice: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
};

type FocusTarget = 'cancel' | 'clearAll' | null;

export function CardList({ cards, onAdd, onChange, onNormalizePrice, onRemove, onClearAll }: CardListProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const focusTargetRef = useRef<FocusTarget>(null);
  const clearAllRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target = focusTargetRef.current;
    if (target === 'cancel') {
      cancelRef.current?.focus();
    } else if (target === 'clearAll') {
      clearAllRef.current?.focus();
    }
    focusTargetRef.current = null;
  }, [confirmingClear]);

  const openConfirm = () => {
    focusTargetRef.current = 'cancel';
    setConfirmingClear(true);
  };

  const closeConfirm = () => {
    focusTargetRef.current = 'clearAll';
    setConfirmingClear(false);
  };

  return (
    <div className={styles.list}>
      <div className={styles.rows}>
        {cards.map((card, index) => (
          <ItemCardEditor
            key={card.id}
            card={card}
            position={index + 1}
            onChange={(patch) => onChange(card.id, patch)}
            onNormalizePrice={() => onNormalizePrice(card.id)}
            onRemove={() => onRemove(card.id)}
          />
        ))}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.stamp} onClick={onAdd}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Add reagent
        </button>
        {confirmingClear ? (
          <div
            className={styles.confirm}
            role="group"
            aria-label="Confirm clear all"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeConfirm();
            }}
          >
            <span className={styles.question}>Clear the recipe and every item?</span>
            <button
              type="button"
              className={styles.confirmYes}
              onClick={() => {
                onClearAll();
                closeConfirm();
              }}
            >
              Yes, clear
            </button>
            <button type="button" className={styles.ghost} ref={cancelRef} onClick={closeConfirm}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className={styles.ghost} ref={clearAllRef} onClick={openConfirm}>
            Clear the page
          </button>
        )}
      </div>
    </div>
  );
}

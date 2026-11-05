import { useState } from 'react';
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

export function CardList({ cards, onAdd, onChange, onNormalizePrice, onRemove, onClearAll }: CardListProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  return (
    <div className={styles.list}>
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
      <div className={styles.actions}>
        <button type="button" onClick={onAdd}>
          Add item
        </button>
        {confirmingClear ? (
          <div className={styles.confirm} role="group" aria-label="Confirm clear all">
            <span>Clear every item?</span>
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setConfirmingClear(false);
              }}
            >
              Yes, clear
            </button>
            <button type="button" onClick={() => setConfirmingClear(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingClear(true)}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

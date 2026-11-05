import styles from '@/components/ItemCardEditor/ItemCardEditor.module.css';
import { toRoman } from '@/components/ItemCardEditor/toRoman';
import { MoneyInput } from '@/components/MoneyInput/MoneyInput';
import { MAX_QUANTITY, parseQuantity, type ItemCard, type ItemCardPatch } from '@/recipe/recipe';

type ItemCardEditorProps = {
  card: ItemCard;
  position: number;
  onChange: (patch: ItemCardPatch) => void;
  onNormalizePrice: () => void;
  onRemove: () => void;
};

export function ItemCardEditor({ card, position, onChange, onNormalizePrice, onRemove }: ItemCardEditorProps) {
  const quantityInvalid = card.quantity === 0;

  return (
    <article className={styles.card} aria-label={`Item ${position}`}>
      <span className={styles.numeral} aria-hidden="true">
        {toRoman(position)}
      </span>
      <input
        className={styles.name}
        aria-label="Item name"
        placeholder="Reagent"
        value={card.name}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <button type="button" className={styles.remove} aria-label={`Remove item ${position}`} onClick={onRemove}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      </button>
      <div className={styles.details}>
        <label className={styles.quantity}>
          <span className={styles.caption}>Qty</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY}
            placeholder="0"
            aria-label="Quantity"
            aria-invalid={quantityInvalid}
            className={quantityInvalid ? `${styles.quantityInput} ${styles.invalid}` : styles.quantityInput}
            value={card.quantity ?? ''}
            onChange={(event) => onChange({ quantity: parseQuantity(event.target.value) })}
          />
        </label>
        <MoneyInput
          label="Unit price"
          caption="each"
          value={card.price}
          onChange={(price) => onChange({ price })}
          onBlur={onNormalizePrice}
        />
      </div>
    </article>
  );
}

import bagIcon from '@/assets/icons/inv_misc_bag_10.png';
import styles from '@/components/ItemCardEditor/ItemCardEditor.module.css';
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
      <img className={styles.icon} src={bagIcon} alt="" width={40} height={40} />
      <div className={styles.fields}>
        <input
          className={styles.name}
          aria-label="Item name"
          placeholder="Item name"
          value={card.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <div className={styles.row}>
          <label className={styles.quantity}>
            <span className={styles.label}>Quantity</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_QUANTITY}
              aria-invalid={quantityInvalid}
              className={quantityInvalid ? styles.invalid : undefined}
              value={card.quantity ?? ''}
              onChange={(event) => onChange({ quantity: parseQuantity(event.target.value) })}
            />
          </label>
          <MoneyInput
            label="Unit price"
            value={card.price}
            onChange={(price) => onChange({ price })}
            onBlur={onNormalizePrice}
          />
        </div>
      </div>
      <button type="button" className={styles.remove} aria-label={`Remove item ${position}`} onClick={onRemove}>
        ✕
      </button>
    </article>
  );
}

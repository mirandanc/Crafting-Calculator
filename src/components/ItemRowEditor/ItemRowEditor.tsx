import { useState } from 'react';
import { AuctionHint } from '@/components/AuctionHint/AuctionHint';
import { Autocomplete, type SearchOption } from '@/components/Autocomplete/Autocomplete';
import { EntryNumeral } from '@/components/EntryNumeral/EntryNumeral';
import styles from '@/components/ItemRowEditor/ItemRowEditor.module.css';
import { MoneyInput } from '@/components/MoneyInput/MoneyInput';
import { RemoveButton } from '@/components/RemoveButton/RemoveButton';
import { useItemSearch } from '@/foreverdb/useItemSearch';
import type { Coins } from '@/money/money';
import type { AuctionHint as AuctionHintState } from '@/prices/auctionPrices';
import { MAX_QUANTITY, parseQuantity, type ItemRow, type LinkedItem } from '@/sheet/sheet';

type ItemRowEditorProps = {
  row: ItemRow;
  position: number;
  price: Coins;
  hint: AuctionHintState;
  onRename: (name: string) => void;
  onLink: (item: LinkedItem) => void;
  onQuantityChange: (quantity: number | null) => void;
  onPriceChange: (price: Coins) => void;
  onPriceBlur: () => void;
  onRestorePrice: () => void;
  onRemove: () => void;
  onReachable: (reachable: boolean) => void;
};

export function ItemRowEditor({
  row,
  position,
  price,
  hint,
  onRename,
  onLink,
  onQuantityChange,
  onPriceChange,
  onPriceBlur,
  onRestorePrice,
  onRemove,
  onReachable,
}: ItemRowEditorProps) {
  // Only rows edited in this session search: a restored row stays quiet until the user types in it.
  // A linked row doesn't search (its name came from ForeverDB); typing unlinks it and searching resumes.
  const [edited, setEdited] = useState(false);
  const results = useItemSearch(edited && row.itemId === null ? row.name : '', onReachable);
  const options: SearchOption[] = results.map((item) => ({ key: String(item.id), label: item.name, detail: null, icon: item.icon }));
  const quantityInvalid = row.quantity === 0;
  // Prices are keyed by name, so a nameless row has no price of its own to set.
  const unnamed = row.name.trim() === '';

  const link = (option: SearchOption) => {
    const item = results.find((candidate) => String(candidate.id) === option.key);
    if (item !== undefined) onLink({ itemId: item.id, name: item.name, icon: item.icon });
  };

  return (
    <article className={styles.row} aria-label={`Item ${position}`}>
      <EntryNumeral position={position} icon={row.icon} />
      <Autocomplete
        label="Item name"
        value={row.name}
        placeholder="Search an item"
        options={options}
        inputClassName={styles.name}
        onInputChange={(name) => {
          setEdited(true);
          onRename(name);
        }}
        onSelect={link}
      />
      <RemoveButton label={`Remove item ${position}`} size="normal" onClick={onRemove} />
      <div className={styles.details}>
        <label className={styles.quantity}>
          <span className={styles.caption}>Quantity</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY}
            placeholder="0"
            aria-label="Quantity"
            aria-invalid={quantityInvalid}
            className={quantityInvalid ? `${styles.quantityInput} ${styles.invalid}` : styles.quantityInput}
            value={row.quantity ?? ''}
            onChange={(event) => onQuantityChange(parseQuantity(event.target.value))}
          />
        </label>
        <div className={styles.price}>
          <MoneyInput
            label="Unit price"
            caption="each"
            value={price}
            onChange={onPriceChange}
            onBlur={onPriceBlur}
            disabledReason={unnamed ? 'Name the item first' : undefined}
          />
          <AuctionHint hint={hint} itemName={row.name.trim()} onRestore={onRestorePrice} />
        </div>
      </div>
    </article>
  );
}

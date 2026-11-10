import { ItemIcon } from '@/components/ItemIcon/ItemIcon';
import { MoneyInput } from '@/components/MoneyInput/MoneyInput';
import styles from '@/components/ReagentRow/ReagentRow.module.css';
import { RemoveButton } from '@/components/RemoveButton/RemoveButton';
import type { Coins } from '@/money/money';
import type { ReagentLine } from '@/sheet/sheet';

type ReagentRowProps = {
  reagent: ReagentLine;
  recipeName: string;
  /** Locked: per-craft count × crafts. */
  quantity: number;
  price: Coins;
  onPriceChange: (price: Coins) => void;
  onPriceBlur: () => void;
  onRemove: () => void;
};

export function ReagentRow({ reagent, recipeName, quantity, price, onPriceChange, onPriceBlur, onRemove }: ReagentRowProps) {
  return (
    <li className={styles.reagent} aria-label={reagent.name}>
      {reagent.icon === null ? (
        <span className={styles.iconGap} aria-hidden="true" />
      ) : (
        <ItemIcon src={reagent.icon} size="row" />
      )}
      <span className={styles.name}>{reagent.name}</span>
      <RemoveButton label={`Remove ${reagent.name} from ${recipeName}`} size="small" onClick={onRemove} />
      <div className={styles.pricing}>
        <span className={styles.count}>
          <span className="sr-only">Quantity</span>
          <span aria-hidden="true">×</span>
          <span>{quantity}</span>
        </span>
        <MoneyInput label={`${reagent.name} price`} caption="each" value={price} onChange={onPriceChange} onBlur={onPriceBlur} />
      </div>
    </li>
  );
}

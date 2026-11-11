import styles from '@/components/PriceHint/PriceHint.module.css';
import { formatMoney } from '@/money/money';
import type { PriceHint as PriceHintState, PriceSource } from '@/prices/marketPrices';

type PriceHintProps = {
  hint: PriceHintState;
  itemName: string;
  onRestore: () => void;
};

const SOURCE_NAMES: Record<PriceSource, string> = { auction: 'auction', vendor: 'vendor' };

/** Next to a price: a "Not on AH" or "Vendor" tag, or a ↺ button that swaps a typed price back to the market one. */
export function PriceHint({ hint, itemName, onRestore }: PriceHintProps) {
  if (hint.kind === 'none') return null;
  if (hint.kind === 'notListed') return <span className={styles.tag}>Not on AH</span>;
  if (hint.kind === 'vendor') return <span className={styles.tag}>Vendor</span>;
  const price = formatMoney(hint.copper);
  const source = SOURCE_NAMES[hint.source];
  return (
    <button
      type="button"
      className={styles.restore}
      title={`Use the ${source} price (${price})`}
      aria-label={`Use the ${source} price for ${itemName} (${price})`}
      onClick={onRestore}
    >
      <span aria-hidden="true">↺</span>
    </button>
  );
}

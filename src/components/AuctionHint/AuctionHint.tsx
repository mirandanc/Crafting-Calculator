import styles from '@/components/AuctionHint/AuctionHint.module.css';
import { formatMoney } from '@/money/money';
import type { AuctionHint as AuctionHintState } from '@/prices/auctionPrices';

type AuctionHintProps = {
  hint: AuctionHintState;
  itemName: string;
  onRestore: () => void;
};

/** Next to a price: a "Not on AH" tag, or a ↺ button that swaps a typed price back to the auction one. */
export function AuctionHint({ hint, itemName, onRestore }: AuctionHintProps) {
  if (hint.kind === 'none') return null;
  if (hint.kind === 'notListed') return <span className={styles.tag}>Not on AH</span>;
  const price = formatMoney(hint.copper);
  return (
    <button
      type="button"
      className={styles.restore}
      title={`Use the auction price (${price})`}
      aria-label={`Use the auction price for ${itemName} (${price})`}
      onClick={onRestore}
    >
      <span aria-hidden="true">↺</span>
    </button>
  );
}

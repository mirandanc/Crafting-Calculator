import { Coin } from '@/components/Coin/Coin';
import styles from '@/components/MoneyText/MoneyText.module.css';
import { formatMoney, fromCopper, type Coins } from '@/money/money';

type MoneyTextProps = {
  copper: number;
  /** Read before the amount by assistive tech only, e.g. "= " or "2 × ". */
  srPrefix?: string;
};

type MoneyPart = {
  denomination: keyof Coins;
  amount: number;
};

function moneyParts(total: number): MoneyPart[] {
  const { gold, silver, copper } = fromCopper(total);
  const parts: MoneyPart[] = [];
  if (gold > 0) parts.push({ denomination: 'gold', amount: gold });
  if (silver > 0) parts.push({ denomination: 'silver', amount: silver });
  if (copper > 0 || parts.length === 0) parts.push({ denomination: 'copper', amount: copper });
  return parts;
}

/**
 * Amount drawn as numbers with coin icons. The accessible text is the formatMoney string ("1s 5c"),
 * so the parts lay themselves out in the parent's flex box (the root is display: contents).
 */
export function MoneyText({ copper, srPrefix = '' }: MoneyTextProps) {
  return (
    <span className={styles.money}>
      <span className="sr-only">
        {srPrefix}
        {formatMoney(copper)}
      </span>
      {moneyParts(copper).map((part) => (
        <span key={part.denomination} className={styles.part} aria-hidden="true">
          {part.amount.toLocaleString('en-US')}
          <Coin denomination={part.denomination} />
        </span>
      ))}
    </span>
  );
}

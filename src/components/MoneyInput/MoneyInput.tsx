import { useId } from 'react';

import { Coin } from '@/components/Coin/Coin';
import styles from '@/components/MoneyInput/MoneyInput.module.css';
import { parseCoin, type Coins } from '@/money/money';

type CoinField = {
  key: keyof Coins;
  max?: number;
};

type MoneyInputProps = {
  label: string;
  caption: string;
  value: Coins;
  onChange: (value: Coins) => void;
  onBlur: () => void;
  /** When set, the fields are disabled and this explains why (as a visible hint the group points to). */
  disabledReason?: string;
};

const COIN_FIELDS: CoinField[] = [{ key: 'gold' }, { key: 'silver', max: 99 }, { key: 'copper', max: 99 }];

export function MoneyInput({ label, caption, value, onChange, onBlur, disabledReason }: MoneyInputProps) {
  const hintId = useId();

  return (
    <fieldset
      className={styles.money}
      disabled={disabledReason !== undefined}
      aria-describedby={disabledReason === undefined ? undefined : hintId}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onBlur();
      }}
    >
      <legend className="sr-only">{label}</legend>
      <span className={styles.caption} aria-hidden="true">
        {caption}
      </span>
      {COIN_FIELDS.map((field) => (
        <label key={field.key} className={styles.coin}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={field.max}
            placeholder="0"
            aria-label={`${label} ${field.key}`}
            className={`${styles.input} ${styles[field.key]}`}
            value={value[field.key] === 0 ? '' : value[field.key]}
            onChange={(event) => onChange({ ...value, [field.key]: parseCoin(event.target.value) })}
          />
          <Coin denomination={field.key} />
        </label>
      ))}
      {disabledReason !== undefined && (
        <span id={hintId} className={styles.hint}>
          {disabledReason}
        </span>
      )}
    </fieldset>
  );
}

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
};

const COIN_FIELDS: CoinField[] = [{ key: 'gold' }, { key: 'silver', max: 99 }, { key: 'copper', max: 99 }];

export function MoneyInput({ label, caption, value, onChange, onBlur }: MoneyInputProps) {
  return (
    <fieldset
      className={styles.money}
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
    </fieldset>
  );
}

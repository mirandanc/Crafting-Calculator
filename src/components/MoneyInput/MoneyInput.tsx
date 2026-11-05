import copperIcon from '@/assets/coins/ui-coppericon.png';
import goldIcon from '@/assets/coins/ui-goldicon.png';
import silverIcon from '@/assets/coins/ui-silvericon.png';
import styles from '@/components/MoneyInput/MoneyInput.module.css';
import type { Coins } from '@/money/money';
import { parseCoin } from '@/recipe/recipe';

type CoinField = {
  key: keyof Coins;
  icon: string;
};

type MoneyInputProps = {
  label: string;
  value: Coins;
  onChange: (value: Coins) => void;
  onBlur: () => void;
};

const COIN_FIELDS: CoinField[] = [
  { key: 'gold', icon: goldIcon },
  { key: 'silver', icon: silverIcon },
  { key: 'copper', icon: copperIcon },
];

export function MoneyInput({ label, value, onChange, onBlur }: MoneyInputProps) {
  return (
    <fieldset
      className={styles.money}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onBlur();
      }}
    >
      <legend className={styles.legend}>{label}</legend>
      {COIN_FIELDS.map((field) => (
        <label key={field.key} className={styles.coin}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            aria-label={`${label} ${field.key}`}
            className={`${styles.input} ${styles[field.key]}`}
            value={value[field.key] === 0 ? '' : value[field.key]}
            onChange={(event) => onChange({ ...value, [field.key]: parseCoin(event.target.value) })}
          />
          <img src={field.icon} alt="" width={16} height={16} />
        </label>
      ))}
    </fieldset>
  );
}

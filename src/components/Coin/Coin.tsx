import copperIcon from '@/assets/coins/ui-coppericon.png';
import goldIcon from '@/assets/coins/ui-goldicon.png';
import silverIcon from '@/assets/coins/ui-silvericon.png';
import styles from '@/components/Coin/Coin.module.css';
import type { Coins } from '@/money/money';

type CoinProps = {
  denomination: keyof Coins;
};

const COIN_ICONS: Record<keyof Coins, string> = {
  gold: goldIcon,
  silver: silverIcon,
  copper: copperIcon,
};

export function Coin({ denomination }: CoinProps) {
  return <img className={styles.coin} src={COIN_ICONS[denomination]} alt="" aria-hidden="true" />;
}

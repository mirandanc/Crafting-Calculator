import styles from '@/components/ItemIcon/ItemIcon.module.css';

type ItemIconSize = 'row' | 'small';

type ItemIconProps = {
  src: string;
  size: ItemIconSize;
};

const SIZE_PX: Record<ItemIconSize, number> = {
  row: 30,
  small: 22,
};

/** A ForeverDB icon. Decorative: the item's name is always written next to it. */
export function ItemIcon({ src, size }: ItemIconProps) {
  return (
    <img
      className={`${styles.icon} ${styles[size]}`}
      src={src}
      alt=""
      width={SIZE_PX[size]}
      height={SIZE_PX[size]}
      loading="lazy"
      decoding="async"
    />
  );
}

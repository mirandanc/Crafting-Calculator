import styles from '@/components/ItemIcon/ItemIcon.module.css';
import { useItemTooltip, type TooltipItem } from '@/components/ItemTooltip/ItemTooltipProvider';

type ItemIconSize = 'row' | 'small';

type ItemIconProps = {
  src: string;
  size: ItemIconSize;
  /** The item the icon stands for; given, a click on the icon opens its tooltip. */
  item?: TooltipItem;
};

const SIZE_PX: Record<ItemIconSize, number> = {
  row: 30,
  small: 22,
};

/**
 * A ForeverDB icon. Decorative: the item's name is always written next to it.
 * Inside an ItemTooltipProvider, clicking it opens the item's tooltip.
 */
export function ItemIcon({ src, size, item }: ItemIconProps) {
  const openTooltip = useItemTooltip();
  const image = (
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
  if (item === undefined || openTooltip === null) return image;

  return (
    <span
      className={styles.trigger}
      onClick={(event) => {
        // The icon has priority: its click never adds the recipe or picks the suggestion underneath.
        event.stopPropagation();
        event.preventDefault();
        openTooltip(item, { x: event.clientX, y: event.clientY });
      }}
    >
      {image}
    </span>
  );
}

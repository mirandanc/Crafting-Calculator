import styles from '@/components/EntryNumeral/EntryNumeral.module.css';
import { toRoman } from '@/components/EntryNumeral/toRoman';
import { ItemIcon } from '@/components/ItemIcon/ItemIcon';
import type { TooltipItem } from '@/components/ItemTooltip/ItemTooltipProvider';

type EntryNumeralProps = {
  position: number;
  icon: string | null;
  item: TooltipItem | null;
};

/** The entry's place on the page as a Roman numeral; once linked, its ForeverDB icon takes that place. */
export function EntryNumeral({ position, icon, item }: EntryNumeralProps) {
  return (
    <span className={styles.numeral} aria-hidden="true">
      {icon === null ? toRoman(position) : <ItemIcon src={icon} size="row" item={item ?? undefined} />}
    </span>
  );
}

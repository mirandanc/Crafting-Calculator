import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ItemIcon } from '@/components/ItemIcon/ItemIcon';
import styles from '@/components/ProfessionPicker/ProfessionPicker.module.css';

type ProfessionPickerProps = {
  /** Every profession, in display order; empty while the recipe book loads. */
  professions: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

const ALL_LABEL = 'All professions';
const LISTED_UP_TO = 2;

/** ForeverDB icon file per profession, as its /professions list gives them. */
const PROFESSION_ICONS: Record<string, number> = {
  Alchemy: 136240,
  Blacksmithing: 136241,
  Cooking: 133971,
  Enchanting: 136244,
  Engineering: 136243,
  'First Aid': 135966,
  Fishing: 136245,
  Herbalism: 136246,
  Leatherworking: 136247,
  Mining: 136248,
  Skinning: 134366,
  Tailoring: 136249,
};

function iconOf(profession: string): string | null {
  const icon: number | undefined = PROFESSION_ICONS[profession];
  return icon === undefined ? null : `https://foreverdb.net/icons/${icon}.webp`;
}

function summaryOf(professions: string[], selected: string[]): string {
  if (selected.length === 0) return ALL_LABEL;
  if (selected.length > LISTED_UP_TO) return `${selected.length} professions`;
  return professions.filter((profession) => selected.includes(profession)).join(', ') || selected.join(', ');
}

/** A multi-select that opens below its summary; none selected means every profession. */
export function ProfessionPicker({ professions, selected, onChange }: ProfessionPickerProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const disabled = professions.length === 0;
  const toggle = (profession: string) =>
    onChange(
      selected.includes(profession)
        ? selected.filter((candidate) => candidate !== profession)
        : professions.filter((candidate) => candidate === profession || selected.includes(candidate)),
    );

  // A press anywhere outside the open menu closes it, like any other dropdown.
  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details !== null && details.open && !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, []);

  // Escape closes an open menu, handing focus back to the summary so the keyboard user stays in place.
  const closeOnEscape = (event: KeyboardEvent<HTMLDetailsElement>) => {
    const details = detailsRef.current;
    if (event.key !== 'Escape' || details === null || !details.open) return;
    event.preventDefault();
    details.open = false;
    summaryRef.current?.focus();
  };

  return (
    <div className={styles.picker} role="group" aria-label="Professions" aria-disabled={disabled}>
      <details ref={detailsRef} onKeyDown={closeOnEscape}>
        <summary ref={summaryRef} className={styles.summary} aria-disabled={disabled} onClick={(event) => disabled && event.preventDefault()}>
          <span className={styles.caption}>Professions</span>
          <span className={styles.value}>{summaryOf(professions, selected)}</span>
        </summary>
        <div className={styles.menu}>
          <button type="button" className={styles.all} aria-label="Clear, show all professions" onClick={() => onChange([])}>
            Clear
          </button>
          {professions.map((profession) => {
            const icon = iconOf(profession);
            return (
              <label key={profession} className={styles.option}>
                <input type="checkbox" checked={selected.includes(profession)} onChange={() => toggle(profession)} />
                {icon === null ? <span className={styles.iconGap} aria-hidden="true" /> : <ItemIcon src={icon} size="small" />}
                {profession}
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}

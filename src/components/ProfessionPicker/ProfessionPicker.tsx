import { useRef, type KeyboardEvent } from 'react';
import styles from '@/components/ProfessionPicker/ProfessionPicker.module.css';

type ProfessionPickerProps = {
  /** Every profession, in display order; empty while the recipe book loads. */
  professions: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

const ALL_LABEL = 'All professions';
const LISTED_UP_TO = 2;

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
          {professions.map((profession) => (
            <label key={profession} className={styles.option}>
              <input type="checkbox" checked={selected.includes(profession)} onChange={() => toggle(profession)} />
              {profession}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

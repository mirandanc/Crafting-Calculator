import { useId, useState, type KeyboardEvent } from 'react';
import styles from '@/components/Autocomplete/Autocomplete.module.css';
import { ItemIcon } from '@/components/ItemIcon/ItemIcon';

export type SearchOption = {
  key: string;
  label: string;
  /** Small-caps hint on the right, e.g. the recipe's profession; null for none. */
  detail: string | null;
  icon: string | null;
};

type AutocompleteProps = {
  /** Accessible name of the input; the listbox is named "<label> suggestions". */
  label: string;
  value: string;
  placeholder: string;
  options: SearchOption[];
  inputClassName: string;
  onInputChange: (value: string) => void;
  onSelect: (option: SearchOption) => void;
  onBlur?: () => void;
};

const NO_OPTION = -1;

/** Editable combobox with list autocomplete (WAI-ARIA APG pattern). */
export function Autocomplete({
  label,
  value,
  placeholder,
  options,
  inputClassName,
  onInputChange,
  onSelect,
  onBlur,
}: AutocompleteProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(NO_OPTION);
  const expanded = open && options.length > 0;
  const active = expanded && activeIndex < options.length ? activeIndex : NO_OPTION;
  const optionId = (index: number): string => `${listboxId}-option-${index}`;

  const close = () => {
    setOpen(false);
    setActiveIndex(NO_OPTION);
  };

  const choose = (option: SearchOption) => {
    onSelect(option);
    close();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (options.length === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const from = active === NO_OPTION ? (step === 1 ? -1 : 0) : active;
      setOpen(true);
      setActiveIndex((from + step + options.length) % options.length);
      return;
    }
    if (event.key === 'Enter' && active !== NO_OPTION) {
      event.preventDefault();
      choose(options[active]);
      return;
    }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className={styles.autocomplete}>
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={active === NO_OPTION ? undefined : optionId(active)}
        autoComplete="off"
        spellCheck={false}
        className={inputClassName}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onInputChange(event.target.value);
          setOpen(true);
          setActiveIndex(NO_OPTION);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          close();
          onBlur?.();
        }}
      />
      <ul id={listboxId} role="listbox" aria-label={`${label} suggestions`} className={styles.listbox} hidden={!expanded}>
        {options.map((option, index) => (
          <li
            key={option.key}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            className={styles.option}
            // Keep focus in the input so the click doesn't blur (and close) the list first.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
          >
            {option.icon !== null && <ItemIcon src={option.icon} size="small" />}
            <span className={styles.label}>{option.label}</span>
            {option.detail !== null && <span className={styles.detail}>{option.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

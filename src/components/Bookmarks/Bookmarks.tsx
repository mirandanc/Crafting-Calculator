import { useRef, type KeyboardEvent } from 'react';
import styles from '@/components/Bookmarks/Bookmarks.module.css';
import type { BookTab } from '@/market/preferences';

type BookmarksProps = {
  selected: BookTab;
  /** Id of the page section the tabs switch. */
  panelId: string;
  onSelect: (tab: BookTab) => void;
};

type Bookmark = {
  tab: BookTab;
  label: string;
};

export const BOOKMARKS: Bookmark[] = [
  { tab: 'list', label: 'Market list' },
  { tab: 'analysis', label: 'Market analysis' },
];

/** Ribbon bookmarks above the left page; arrow keys move between them as in any tab list. */
export function Bookmarks({ selected, panelId, onSelect }: BookmarksProps) {
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = (index + step + BOOKMARKS.length) % BOOKMARKS.length;
    tabsRef.current[next]?.focus();
    onSelect(BOOKMARKS[next].tab);
  };

  return (
    <div className={styles.bookmarks} role="tablist" aria-label="Book sections">
      {BOOKMARKS.map((bookmark, index) => {
        const active = bookmark.tab === selected;
        return (
          <button
            key={bookmark.tab}
            ref={(element) => {
              tabsRef.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`bookmark-${bookmark.tab}`}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            className={active ? `${styles.bookmark} ${styles.active}` : styles.bookmark}
            onClick={() => onSelect(bookmark.tab)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {bookmark.label}
          </button>
        );
      })}
    </div>
  );
}

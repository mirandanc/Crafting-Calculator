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

/** Id of a bookmark's tab, so the page it shows can be labelled by it. */
export function bookmarkId(tab: BookTab): string {
  return `bookmark-${tab}`;
}

/** Ribbon bookmarks above the left page; arrow keys, Home and End move between them as in any tab list. */
export function Bookmarks({ selected, panelId, onSelect }: BookmarksProps) {
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = BOOKMARKS.length - 1;
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % BOOKMARKS.length;
    else if (event.key === 'ArrowLeft') next = (index + last) % BOOKMARKS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
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
            id={bookmarkId(bookmark.tab)}
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

import type { ReactNode } from 'react';
import styles from '@/components/Page/Page.module.css';

type PageSide = 'left' | 'right';

/** The page is named by its own label, or by another element such as the bookmark that shows it. */
type PageName = { label: string } | { labelledBy: string };

type PageProps = PageName & {
  side: PageSide;
  heading: string;
  children: ReactNode;
  id?: string;
  /** Set when the page is the panel of the book's bookmarks. */
  role?: 'tabpanel';
  /** Plays the page turn as the page mounts. */
  turning?: boolean;
};

type FlourishProps = {
  className: string;
};

function Flourish({ className }: FlourishProps) {
  return (
    <svg
      className={`${styles.flourish} ${className}`}
      aria-hidden="true"
      width="70"
      height="70"
      viewBox="0 0 70 70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    >
      <path d="M6 64V22C6 12 12 6 22 6h42" />
      <path d="M12 64V26c0-8 6-14 14-14h38" opacity=".5" />
      <path d="M22 22c8-10 22-6 18 4-3 7-13 5-11-1 1.5-4 7-3 6 1" />
      <circle cx="6" cy="64" r="2" fill="currentColor" />
      <circle cx="64" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

export function Page(props: PageProps) {
  const { side, heading, children, id, role, turning = false } = props;
  const label = 'label' in props ? props.label : undefined;
  const labelledBy = 'labelledBy' in props ? props.labelledBy : undefined;
  return (
    <section
      id={id}
      role={role}
      className={`${styles.page} ${styles[side]}`}
      aria-label={label}
      aria-labelledby={labelledBy}
      data-turning={turning ? 'true' : undefined}
    >
      <Flourish className={styles.cornerTop} />
      <Flourish className={styles.cornerBottom} />
      <div className={styles.heading}>
        <span className={styles.ruleIn} aria-hidden="true" />
        <h2 className={styles.headingText}>{heading}</h2>
        <span className={styles.ruleOut} aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}

import styles from '@/components/ConnectionNotice/ConnectionNotice.module.css';

type ConnectionNoticeProps = {
  lost: boolean;
};

/** Discreet line shown after an item search fails; always mounted so the change is announced. */
export function ConnectionNotice({ lost }: ConnectionNoticeProps) {
  return (
    <p className={styles.notice} role="status">
      {lost ? 'Lost touch with ForeverDB. Item search will try again as you type.' : ''}
    </p>
  );
}

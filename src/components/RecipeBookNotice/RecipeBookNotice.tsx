import styles from '@/components/RecipeBookNotice/RecipeBookNotice.module.css';

type RecipeBookNoticeProps = {
  failed: boolean;
};

/** Discreet line shown when the recipe catalog could not load; always mounted so the change is announced. */
export function RecipeBookNotice({ failed }: RecipeBookNoticeProps) {
  return (
    <p className={styles.notice} role="status">
      {failed ? 'The recipe book could not be opened. Recipe search is unavailable.' : ''}
    </p>
  );
}

import { ItemIcon } from '@/components/ItemIcon/ItemIcon';
import { MoneyText } from '@/components/MoneyText/MoneyText';
import { Page } from '@/components/Page/Page';
import styles from '@/components/ShoppingList/ShoppingList.module.css';
import type { ShoppingSummary } from '@/sheet/shopping';

type ShoppingListProps = {
  summary: ShoppingSummary;
};

export function ShoppingList({ summary }: ShoppingListProps) {
  const { lines, total, unpricedCount } = summary;
  const hasLines = lines.length > 0;

  return (
    <Page side="right" label="Shopping list" heading="Shopping list">
      {hasLines ? (
        <ul className={styles.lines}>
          {lines.map((line) => (
            <li key={line.key} className={styles.line}>
              {line.icon === null ? (
                <span className={styles.iconGap} aria-hidden="true" />
              ) : (
                <ItemIcon
                  src={line.icon}
                  size="small"
                  item={line.itemId === null ? undefined : { itemId: line.itemId, name: line.name }}
                />
              )}
              <span className={styles.what}>
                <span className={styles.name} title={line.name}>
                  {line.name}
                </span>
                {line.sources.length > 0 && <span className={styles.sources}>{line.sources.join(', ')}</span>}
              </span>
              <span className={styles.leader} aria-hidden="true" />
              <span className={styles.math}>
                {line.unitPrice > 0 ? (
                  <>
                    <span aria-hidden="true">{line.quantity} ×</span>
                    <MoneyText copper={line.unitPrice} srPrefix={`${line.quantity} × `} />
                  </>
                ) : (
                  <span>{line.quantity}</span>
                )}
              </span>
              <span className={styles.amount}>
                {line.unitPrice > 0 ? (
                  <MoneyText copper={line.quantity * line.unitPrice} srPrefix="= " />
                ) : (
                  <span className={styles.unpriced}>unpriced</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Nothing to buy yet.</p>
      )}
      {hasLines && (
        <div className={styles.divider} aria-hidden="true">
          <svg width="260" height="18" viewBox="0 0 260 18" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M0 9h108" />
            <path d="M152 9h108" />
            <path className={styles.diamond} d="M130 1l8 8-8 8-8-8z" stroke="none" />
            <circle cx="114" cy="9" r="2" fill="currentColor" stroke="none" />
            <circle cx="146" cy="9" r="2" fill="currentColor" stroke="none" />
          </svg>
        </div>
      )}
      <div className={styles.totals}>
        {/* Always mounted, and the label lives inside the live region, so a change is never announced as a bare number. */}
        <div className={styles.total} aria-live="polite">
          {hasLines && total > 0 && (
            <>
              <span className={styles.totalLabel}>Total cost</span>
              <MoneyText copper={total} />
            </>
          )}
        </div>
        {unpricedCount > 0 && (
          <p className={styles.unpricedNote}>
            {unpricedCount} {unpricedCount === 1 ? 'item' : 'items'} unpriced
          </p>
        )}
      </div>
    </Page>
  );
}

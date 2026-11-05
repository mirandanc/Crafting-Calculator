import styles from '@/components/Invoice/Invoice.module.css';
import { MoneyText } from '@/components/MoneyText/MoneyText';
import { Page } from '@/components/Page/Page';
import { toCopper } from '@/money/money';
import { invoiceTotal, lineTotal, type ItemCard } from '@/recipe/recipe';

type InvoiceProps = {
  title: string;
  lines: ItemCard[];
};

export function Invoice({ title, lines }: InvoiceProps) {
  const hasLines = lines.length > 0;

  return (
    <Page side="right" label="Invoice" heading="Tally">
      <h3 className={styles.title}>{title.trim() === '' ? 'Unnamed recipe' : title}</h3>
      {hasLines ? (
        <ul className={styles.lines}>
          {lines.map((line) => (
            <li key={line.id} className={styles.line}>
              <span className={styles.name}>{line.name}</span>
              <span className={styles.leader} aria-hidden="true" />
              <span className={styles.math}>
                <span aria-hidden="true">{line.quantity} ×</span>
                <MoneyText copper={toCopper(line.price)} srPrefix={`${line.quantity} × `} />
              </span>
              <span className={styles.amount}>
                <MoneyText copper={lineTotal(line)} srPrefix="= " />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Nothing tallied yet.</p>
      )}
      {hasLines && (
        <>
          <div className={styles.divider} aria-hidden="true">
            <svg width="260" height="18" viewBox="0 0 260 18" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M0 9h108" />
              <path d="M152 9h108" />
              <path className={styles.diamond} d="M130 1l8 8-8 8-8-8z" stroke="none" />
              <circle cx="114" cy="9" r="2" fill="currentColor" stroke="none" />
              <circle cx="146" cy="9" r="2" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <span className={styles.totalLabel}>Total cost</span>
        </>
      )}
      {/* Always mounted so screen readers announce the total when the first row lands. */}
      <div className={styles.total} aria-live="polite">
        {hasLines && <MoneyText copper={invoiceTotal(lines)} />}
      </div>
    </Page>
  );
}

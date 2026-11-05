import crestUrl from '@/assets/crest/pvprankalliance.png';
import styles from '@/components/Invoice/Invoice.module.css';
import { formatMoney, toCopper } from '@/money/money';
import { invoiceTotal, lineTotal, type ItemCard } from '@/recipe/recipe';

type InvoiceProps = {
  title: string;
  lines: ItemCard[];
};

export function Invoice({ title, lines }: InvoiceProps) {
  return (
    <section className={styles.invoice} aria-label="Invoice">
      <img className={styles.watermark} src={crestUrl} alt="" />
      <div className={styles.content}>
        {title.trim() !== '' && <h2 className={styles.title}>{title}</h2>}
        {lines.length > 0 && (
          <>
            <ul className={styles.lines}>
              {lines.map((line) => (
                <li key={line.id} className={styles.line}>
                  <span className={styles.name}>{line.name}</span>
                  <span className={styles.math}>
                    {line.quantity} × {formatMoney(toCopper(line.price))}
                  </span>
                  <span className={styles.amount}>= {formatMoney(lineTotal(line))}</span>
                </li>
              ))}
            </ul>
            <p className={styles.total}>
              <span>Total</span>
              <span className={styles.totalAmount}>{formatMoney(invoiceTotal(lines))}</span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

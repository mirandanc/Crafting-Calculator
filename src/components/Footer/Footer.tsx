import foreverDbLogo from '@/assets/foreverdb/foreverdb-logo.svg';
import styles from '@/components/Footer/Footer.module.css';
import type { AuctionStatus } from '@/prices/auctionPrices';

type FooterProps = {
  /** null while auction prices load. */
  auctionStatus: AuctionStatus | null;
};

export function Footer({ auctionStatus }: FooterProps) {
  return (
    <footer className={styles.footer}>
      {/* Always mounted, so screen readers hear the change once prices arrive. */}
      <p className={styles.status} role="status" data-stale={auctionStatus?.stale === true ? 'true' : undefined}>
        {auctionStatus?.text ?? ''}
      </p>
      <a className={styles.credit} href="https://foreverdb.net">
        Data by <img src={foreverDbLogo} alt="" width={16} height={16} /> ForeverDB.net
      </a>
    </footer>
  );
}

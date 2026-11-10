import foreverDbLogo from '@/assets/foreverdb/foreverdb-logo.svg';
import styles from '@/components/Footer/Footer.module.css';
import { auctionStatusOf, type AuctionPricesState } from '@/prices/auctionPrices';
import { useNow } from '@/prices/useNow';

type FooterProps = {
  auction: AuctionPricesState;
};

/** How often the "updated … ago" line is refreshed. Only the footer re-renders on this tick. */
const STATUS_REFRESH_MS = 60_000;

export function Footer({ auction }: FooterProps) {
  const now = useNow(STATUS_REFRESH_MS);
  // null while auction prices load.
  const auctionStatus = auctionStatusOf(auction, now);

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

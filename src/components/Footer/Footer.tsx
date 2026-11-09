import foreverDbLogo from '@/assets/foreverdb/foreverdb-logo.svg';
import styles from '@/components/Footer/Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <a className={styles.credit} href="https://foreverdb.net">
        Data by <img src={foreverDbLogo} alt="" width={16} height={16} /> ForeverDB.net
      </a>
    </footer>
  );
}

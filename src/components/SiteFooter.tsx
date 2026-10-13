import Link from 'next/link';
import { es } from '@/i18n/es';
import styles from './SiteFooter.module.scss';

/** Pie común a todo el sitio: el aviso de proyecto de fans y el enlace a Créditos (SPEC 10). */
export function SiteFooter() {
  return (
    <footer className={styles.footer} aria-label={es.footer.label}>
      <div className={styles.inner}>
        <p className={styles.notice}>{es.footer.notice}</p>
        <Link className={styles.link} href="/creditos">
          {es.footer.credits}
        </Link>
      </div>
    </footer>
  );
}

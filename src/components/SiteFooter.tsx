import { es } from '@/i18n/es';
import styles from './SiteFooter.module.scss';

/** Pie común a todo el sitio: el aviso de proyecto de fans (SPEC 10). */
export function SiteFooter() {
  return (
    <footer className={styles.footer} aria-label={es.footer.label}>
      <p className={styles.notice}>{es.footer.notice}</p>
    </footer>
  );
}

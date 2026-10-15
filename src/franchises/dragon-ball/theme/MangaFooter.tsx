import Link from 'next/link';
import { es } from '@/i18n/es';
import styles from './MangaFooter.module.scss';

/**
 * Pie de Dragon Ball (slot `Footer`): solo un globo de diálogo de manga, blanco, con el aviso de proyecto de fans
 * (SPEC 10) y el enlace a Créditos. Sin recuadro detrás: el globo va directo sobre el paisaje.
 */
export function MangaFooter() {
  return (
    <footer className={styles.footer} aria-label={es.footer.label}>
      <div className={styles.inner}>
        <div className={styles.balloon}>
          <p className={styles.notice}>{es.footer.notice}</p>
          <Link className={styles.link} href="/creditos">
            {es.footer.credits}
          </Link>
        </div>
      </div>
    </footer>
  );
}

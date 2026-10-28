import Link from 'next/link';
import { FooterDismissButton } from '@/components/DismissibleFooter';
import { es } from '@/i18n/es';
import styles from './Footer.module.scss';
import { TempleGlyph } from './TempleGlyph';

/** Carta horizontal propia: el cierre tiene una columna que nunca invade la caja de texto. */
export function CardFooter() {
  return (
    <footer className={styles.footer} aria-label={es.footer.label} data-duel-footer>
      <div className={styles.card}>
        <span className={styles.ornament} aria-hidden="true"><TempleGlyph kind="ankh" /></span>
        <div className={styles.text}>
          <p data-footer-notice>{es.footer.notice}</p>
          <Link className={styles.credits} href="/creditos">{es.footer.credits}</Link>
        </div>
        <FooterDismissButton className={styles.close} />
      </div>
    </footer>
  );
}

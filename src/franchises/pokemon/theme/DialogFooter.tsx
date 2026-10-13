import Link from 'next/link';
import { PixelIcon } from '@/components/ui/icons';
import { Panel } from '@/components/ui/Panel';
import { es } from '@/i18n/es';
import styles from './DialogFooter.module.scss';

/**
 * Pie de Pokémon (slot `Footer`): un cuadro de diálogo de juego de la época, con marco doble escalonado,
 * texto oscuro con sombra gris y un ▼ que parpadea una vez por segundo (quieto con movimiento reducido).
 * Conserva el aviso de proyecto de fans (SPEC 10) y el enlace a Créditos.
 */
export function DialogFooter() {
  return (
    <footer className={styles.footer} aria-label={es.footer.label}>
      <div className={styles.inner}>
        <Panel variant="dialog" className={styles.box}>
          <p className={styles.notice}>{es.footer.notice}</p>
          <Link className={styles.link} href="/creditos">
            {es.footer.credits}
          </Link>
          <span className={styles.more} aria-hidden="true">
            <PixelIcon name="more" />
          </span>
        </Panel>
      </div>
    </footer>
  );
}

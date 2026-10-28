import { CardBack } from './CardBack';
import styles from './Loader.module.scss';
import { TempleGlyph } from './TempleGlyph';

/** Dos paquetes se cruzan sobre el mazo. El contenedor común anuncia la carga. */
export function ShuffleLoader() {
  return (
    <span className={styles.loader} data-temple-loader aria-hidden="true">
      <span className={styles.base}><CardBack /></span>
      <span className={styles.left}><CardBack /></span>
      <span className={styles.right}><CardBack /></span>
      <span className={styles.emblem}><TempleGlyph kind="scarab" /></span>
    </span>
  );
}

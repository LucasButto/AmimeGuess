import { DragonBall } from './DragonBall';
import styles from './Loader.module.scss';

/** Slot `Loader`: una esfera del dragón de 4 estrellas que gira (quieta con movimiento reducido). */
export function DragonLoader() {
  return (
    <span className={styles.loader} aria-hidden="true">
      <DragonBall stars={4} className={styles.ball} />
    </span>
  );
}

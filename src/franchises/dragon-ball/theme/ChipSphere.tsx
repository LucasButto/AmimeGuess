import type { ChipMarkProps } from '../../types';
import { DragonBall } from './DragonBall';
import styles from './ChipSphere.module.scss';

/** Las estrellas de la esfera de cada serie en los filtros: Dragon Ball 1, Z 2, GT 3, Super 4 y Daima 5. */
const SERIES_STARS: Readonly<Record<string, number>> = { db: 1, dbz: 2, gt: 3, super: 4, daima: 5 };

/**
 * Slot `ChipMark` de Dragon Ball: una mini esfera encendida (naranja, con tantas estrellas como diga la serie) con la
 * serie activa; apagada, solo un anillo gris vacío. Cambia la forma (llena o vacía), no solo el color. Lo que no es una
 * serie (los interruptores de los modos de imagen) lleva la esfera de una estrella.
 */
export function ChipSphere({ on, id }: ChipMarkProps) {
  return on ? (
    <DragonBall stars={(id && SERIES_STARS[id]) || 1} className={styles.mark} />
  ) : (
    <svg className={`${styles.mark} ${styles.off}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="13" />
    </svg>
  );
}

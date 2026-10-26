import { es } from '@/i18n/es';
import type { CellBackProps, WinCelebrationProps } from '../../types';
import styles from './Substitution.module.scss';

/**
 * Slot `CellBack` de Naruto: el dorso de cada celda del Clásico es una nube de humo con un tronco adentro (la técnica de
 * sustitución). Mientras la celda se revela, el tronco sale volando hacia arriba girando, las bocanadas se abren y el dorso
 * se desvanece; debajo queda la cara (revelación `swap`). Cada columna usa su retraso (`--reveal-delay`). Decorativo.
 */
export function SmokeBack({ index }: CellBackProps) {
  return (
    <span className={styles.back} data-side={index % 2 === 0 ? 'right' : 'left'} aria-hidden="true">
      <i className={styles.puff} />
      <i className={styles.puff} />
      <i className={styles.puff} />
      <span className={styles.log} />
    </span>
  );
}

/**
 * Slot `WinCelebration` de Naruto: sobre la imagen de la respuesta se estampa un sello rojo grande con "¡Misión
 * cumplida!" (cae desde arriba y golpea; quieto con movimiento reducido). No pinta nada debajo del resumen.
 */
export function MissionStamp({ part }: WinCelebrationProps) {
  if (part !== 'media') return null;
  return (
    <span className={styles.stamp} aria-hidden="true">
      <span className={styles.stampText}>{es.narutoSkin.missionComplete}</span>
    </span>
  );
}

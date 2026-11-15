import type { WinCelebrationProps } from '../../types';
import styles from './Win.module.scss';

/**
 * Slot `WinCelebration` de Dragon Ball: sobre la imagen de la respuesta, un aura dorada que late dos veces y queda
 * encendida (quieta con movimiento reducido). No pinta nada debajo del resumen.
 */
export function GoldenAura({ part }: WinCelebrationProps) {
  if (part !== 'media') return null;
  return <span className={styles.aura} aria-hidden="true" />;
}

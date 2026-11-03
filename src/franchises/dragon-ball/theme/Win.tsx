import type { MetricMarkProps, WinCelebrationProps } from '../../types';
import styles from './Win.module.scss';

/**
 * Slot `WinCelebration` de Dragon Ball: sobre la imagen de la respuesta, un aura dorada que late dos veces y queda
 * encendida (quieta con movimiento reducido). No pinta nada debajo del resumen.
 */
export function GoldenAura({ part }: WinCelebrationProps) {
  if (part !== 'media') return null;
  return <span className={styles.aura} aria-hidden="true" />;
}

/**
 * Slot `MetricMark` de Dragon Ball: al lado de la pregunta del Nivel de poder, un scouter (la imagen de la hoja de íconos,
 * `public/icons/dragon-ball/scouter.webp`). Decorativo: la pregunta ya lo dice con palabras.
 */
export function ScouterIcon({ metric }: MetricMarkProps) {
  if (metric !== 'ki') return null;
  return <img className={styles.scouter} src="/icons/dragon-ball/scouter.webp" alt="" width={200} height={200} draggable={false} aria-hidden="true" />;
}

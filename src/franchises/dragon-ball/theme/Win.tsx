import { es } from '@/i18n/es';
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
 * Slot `MetricMark` de Dragon Ball: al lado de la pregunta del Nivel de poder, un scouter (el visor de una oreja, con la
 * lente verde y su antena). Decorativo: la pregunta ya lo dice con palabras.
 */
export function ScouterIcon({ metric }: MetricMarkProps) {
  if (metric !== 'ki') return null;
  return (
    <svg className={styles.scouter} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <title>{es.dragonBallSkin.ki}</title>
      <path className={styles.band} d="M6 8 L12 8 L12 26 L6 26 Z" />
      <path className={styles.arm} d="M12 14 L22 14" />
      <rect className={styles.lens} x="18" y="7" width="11" height="14" rx="3" />
      <path className={styles.glint} d="M21 11 L25 11 M21 14 L23 14" />
      <path className={styles.arm} d="M25 7 L25 3" />
      <circle className={styles.tip} cx="25" cy="3" r="1.6" />
    </svg>
  );
}

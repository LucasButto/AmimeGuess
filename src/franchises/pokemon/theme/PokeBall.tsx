import type { BallName } from './BallImage';
import styles from './PokeBall.module.scss';

interface PokeBallProps {
  /** El color de la bola: `red` es la Poké Ball y `blue` la Super Ball; cualquier otro, la Poké Ball. */
  tone?: string;
  /** Tamaño de la caja: 12 píxeles de arte (`px`) o 12 medios píxeles (`half`, para botones chicos). */
  unit?: 'px' | 'half';
  /** La mitad de arriba levantada. */
  open?: boolean;
  className?: string;
}

const TONE_BALL: Readonly<Record<string, BallName>> = { red: 'poke', blue: 'super' };

/**
 * Una bola de imagen (`public/theme/pokemon/balls/<nombre>.webp`, de la hoja de bolas), partida por el cinturón en dos copias
 * del mismo archivo para que la de arriba se pueda levantar. Es decorativa: quien la usa pone el texto. Los estilos de quien la
 * contiene pueden moverla con los atributos `[data-ball]` y `[data-half='top' | 'bottom']`.
 */
export function PokeBall({ tone = 'red', unit = 'px', open = false, className }: PokeBallProps) {
  const src = `/theme/pokemon/balls/${TONE_BALL[tone] ?? 'poke'}.webp`;
  return (
    <span className={className ? `${styles.ball} ${className}` : styles.ball} data-ball="" data-unit={unit} data-open={open} aria-hidden="true">
      <span className={styles.top} data-half="top">
        <img className={styles.art} src={src} alt="" width={173} height={173} draggable={false} />
      </span>
      <span className={styles.bottom} data-half="bottom">
        <img className={styles.art} src={src} alt="" width={173} height={173} draggable={false} />
      </span>
    </span>
  );
}

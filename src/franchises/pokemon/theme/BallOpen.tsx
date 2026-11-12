import type { BallName } from './BallImage';
import styles from './BallOpen.module.scss';

/** Las bolas que tienen tira de cuadros (`public/theme/pokemon/balls/abrir/<nombre>.webp`, ver `npm run design:balls`). */
export type OpenBallName = 'poke' | 'super' | 'ultra' | 'veloz' | 'master';

const OPEN_BALLS: ReadonlySet<string> = new Set<OpenBallName>(['poke', 'super', 'ultra', 'veloz', 'master']);

export function hasOpenFrames(ball: BallName): ball is OpenBallName {
  return OPEN_BALLS.has(ball);
}

interface BallOpenProps {
  ball: OpenBallName;
  /** Tamaño de la caja: 12 píxeles de arte (`px`) o 12 medios píxeles (`half`, para botones chicos). */
  unit?: 'px' | 'half';
  className?: string;
}

/**
 * Una bola que se abre en 7 cuadros, de cerrada a abierta. La caja mide lo que la bola cerrada; la celda de la tira es más alta
 * (la tapa sube) y desborda hacia arriba sin ocupar lugar. Se muestra un cuadro por vez moviendo la tira (`[data-strip]`) con
 * `transform`: quien la usa elige el cuadro con `--ball-frame` (0 a 6; el cambio se anima a pasos) o le pone su propia
 * animación a `[data-strip]`. Es decorativa: quien la usa pone el texto.
 */
export function BallOpen({ ball, unit = 'px', className }: BallOpenProps) {
  return (
    <span className={className ? `${styles.ball} ${className}` : styles.ball} data-ball="" data-unit={unit} aria-hidden="true">
      <span className={styles.cell}>
        <img className={styles.strip} src={`/theme/pokemon/balls/abrir/${ball}.webp`} alt="" width={1778} height={354} draggable={false}
          data-strip="" />
      </span>
    </span>
  );
}

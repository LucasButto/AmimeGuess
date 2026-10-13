import { PixelArt } from '@/components/ui/PixelArt';
import { BALL_BOTTOM_ROWS, BALL_TOP_ROWS, ballColors, inlineArt } from './art';
import styles from './PokeBall.module.scss';

interface PokeBallProps {
  /** Color de la paleta de la mitad de arriba (`red`, `blue`, `yellow`…): el tono de cada modo. */
  tone?: string;
  /** Tamaño de cada píxel del dibujo: un píxel de arte (`px`) o medio (`half`, para botones chicos). */
  unit?: 'px' | 'half';
  /** La mitad de arriba levantada (modo resuelto hoy). */
  open?: boolean;
  className?: string;
}

/**
 * Bola pixel de 12 × 12, dibujada en dos mitades (art.ts) para que la de arriba se pueda levantar. Es
 * decorativa: quien la usa pone el texto. Los estilos de quien la contiene pueden moverla con los atributos
 * `[data-ball]` y `[data-half='top' | 'bottom']`.
 */
export function PokeBall({ tone = 'red', unit = 'px', open = false, className }: PokeBallProps) {
  const colors = ballColors(tone);
  return (
    <span className={className ? `${styles.ball} ${className}` : styles.ball} data-ball="" data-unit={unit} data-open={open} aria-hidden="true">
      <span className={styles.top} data-half="top">
        <PixelArt art={inlineArt({ rows: BALL_TOP_ROWS, colors })} size="fill" className={styles.art} />
      </span>
      <span className={styles.bottom} data-half="bottom">
        <PixelArt art={inlineArt({ rows: BALL_BOTTOM_ROWS, colors })} size="fill" className={styles.art} />
      </span>
    </span>
  );
}

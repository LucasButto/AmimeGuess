import { PixelArt } from '@/components/ui/PixelArt';
import type { ChipMarkProps } from '../../types';
import { BALL_BOTTOM_ROWS, BALL_TOP_ROWS, inlineArt } from './art';
import styles from './ChipBall.module.scss';
import { PokeBall } from './PokeBall';

/** La bola vacía: solo el contorno (y la banda) en gris, sin relleno. Otra forma, no solo otro color. */
const EMPTY_BALL = inlineArt({
  colors: { K: 'gray' },
  rows: [...BALL_TOP_ROWS, ...BALL_BOTTOM_ROWS].map((row) => row.replace(/[^K.]/g, '.')),
});

/** Slot `ChipMark` de Pokémon: bola cerrada y roja con la generación activa; vacía y gris, apagada. */
export function ChipBall({ on }: ChipMarkProps) {
  return on ? <PokeBall unit="half" className={styles.mark} /> : <PixelArt art={EMPTY_BALL} size="fill" className={`${styles.mark} ${styles.empty}`} />;
}

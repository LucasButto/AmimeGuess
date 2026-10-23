import type { ImageBackProps } from '../../types';
import styles from './CardBack.module.scss';
import { PokeBall } from './PokeBall';

/**
 * Slot `ImageBack` de Pokémon: el dorso de una carta, dibujado en pixel art propio (no es el de la carta oficial): un
 * cuadro azul con un marco de dos anillos, una trama de rombos y una bola grande en el centro. Solo para las cartas.
 */
export function CardBack({ kind }: ImageBackProps) {
  if (kind !== 'tcg-card') return null;
  return (
    <span className={styles.back}>
      <span className={styles.ring}>
        <span className={styles.badge}>
          <PokeBall unit="px" />
        </span>
      </span>
    </span>
  );
}

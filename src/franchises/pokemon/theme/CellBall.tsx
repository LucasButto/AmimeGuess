import styles from './CellBall.module.scss';
import { PokeBall } from './PokeBall';

/** Slot `CellBack` de Pokémon: el dorso de cada celda del Clásico es una bola chica sobre un cuadro celeste. */
export function CellBall() {
  return (
    <span className={styles.back} aria-hidden="true">
      <PokeBall unit="half" />
    </span>
  );
}

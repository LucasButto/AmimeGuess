import type { WinCelebrationProps } from '../../types';
import styles from './WinCelebration.module.scss';

/**
 * Festejo de Pokémon al ganar (slot `WinCelebration`). Sobre la imagen (`media`): un destello pixel corto
 * alrededor del Pokémon, quieto con movimiento reducido. Debajo del resumen (`details`) no agrega nada: las
 * estadísticas base ya no se muestran.
 */
export function PokemonWinCelebration({ part }: WinCelebrationProps) {
  if (part === 'media') return <span className={styles.sparkle} aria-hidden="true" />;
  return null;
}

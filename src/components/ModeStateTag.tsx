import { es } from '@/i18n/es';
import styles from './ModeStateTag.module.scss';

/** Cómo te fue hoy en un modo: `unknown` es mientras no se leyeron las partidas guardadas. */
export type ModeState = 'unknown' | 'won' | 'lost' | 'pending';

/** El texto del estado: Completado, Fallado o Pendiente (antes de saberlo, el de pendiente, para reservar el lugar). */
export function modeStateText(state: ModeState): string {
  const { rowState } = es.franchise;
  return state === 'won' ? rowState.won : state === 'lost' ? rowState.lost : rowState.pending;
}

/**
 * El estado de hoy de un modo (hub del teléfono y Retos): solo la palabra, sin recuadro, y el color lo dice todo.
 * Pendiente es negro; Completado, verde; Fallado, rojo. Los colores salen de los tokens de cada tema (los mismos de
 * los resultados del Clásico), así que cada franquicia la pinta con los suyos. Decorativa: el nombre accesible lo lleva el enlace.
 * `onBar`: va sobre la barra de color del Clásico, donde el verde y el rojo llevan un contorno claro para leerse.
 */
export function ModeStateTag({ state, onBar = false }: { state: ModeState; onBar?: boolean }) {
  return (
    <span className={styles.tag} data-state={state} data-on-bar={onBar} aria-hidden="true">
      {modeStateText(state)}
    </span>
  );
}

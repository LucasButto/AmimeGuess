import { hasFranchiseData, type FranchiseData } from '@/franchises/data';
import { minimumPoolOf, modePoolSize } from '@/franchises/pool';
import type { FranchiseConfig, ModeConfig } from '@/franchises/types';
import { hasMinimumPool } from '@/engine/filters';

/**
 * ¿Existe el motor de este modo y la franquicia ya tiene datos? Hace falta que su motor
 * exista (y que el modo traiga la configuración de ese motor) y que la franquicia tenga datos.
 */
export function isPlayable(franchise: FranchiseConfig, mode: ModeConfig): boolean {
  const configured =
    (mode.engine === 'classic' && mode.classic !== undefined) ||
    (mode.engine === 'image-reveal' && mode.imageReveal !== undefined) ||
    (mode.engine === 'text-clue' && mode.textClue !== undefined) ||
    (mode.engine === 'reveal-list' && mode.revealList !== undefined) ||
    (mode.engine === 'higher-lower' && mode.higherLower !== undefined) ||
    (mode.engine === 'timeline' && mode.timeline !== undefined) ||
    (mode.engine === 'connections' && mode.connections !== undefined);
  return configured && hasFranchiseData(franchise.slug);
}

/**
 * Cómo se muestra un modo en la interfaz:
 *  - `playable`: se puede jugar.
 *  - `soon`: todavía no existe (su motor o los datos de la franquicia): se ve apagado, "próximamente".
 *  - `hidden`: existe, pero con todas las series activas su pool no llega al mínimo (SPEC 8):
 *    no aparece en la navegación ni en la lista de la franquicia. Pasa, por ejemplo, con un
 *    modo de frases mientras ninguna esté verificada.
 *
 * Se decide con los datos de la franquicia (`data`), que la página lee al generarse.
 */
export type ModeStatus = 'playable' | 'soon' | 'hidden';

export function modeStatus(franchise: FranchiseConfig, mode: ModeConfig, data: FranchiseData | undefined): ModeStatus {
  if (!isPlayable(franchise, mode) || data === undefined) return 'soon';
  const size = modePoolSize(mode, data, franchise.series);
  return size !== null && hasMinimumPool(size, minimumPoolOf(mode)) ? 'playable' : 'hidden';
}

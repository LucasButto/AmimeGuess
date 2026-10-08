import { hasFranchiseData } from '@/franchises/data';
import type { FranchiseConfig, ModeConfig } from '@/franchises/types';

/**
 * ¿Se puede jugar este modo hoy? Hace falta que su motor exista (y que el modo
 * traiga la configuración de ese motor) y que la franquicia ya tenga datos. Lo
 * usan la página (para la navegación entre modos) y el despacho (para montar el
 * juego o mostrar "Próximamente").
 */
export function isPlayable(franchise: FranchiseConfig, mode: ModeConfig): boolean {
  const configured =
    (mode.engine === 'classic' && mode.classic !== undefined) ||
    (mode.engine === 'image-reveal' && mode.imageReveal !== undefined) ||
    (mode.engine === 'text-clue' && mode.textClue !== undefined);
  return configured && hasFranchiseData(franchise.slug);
}

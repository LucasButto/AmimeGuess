import type { ModeConfig } from '@/franchises/types';
import { ArcadeIcon, type ArcadeIconSize } from './arcade/ArcadeIcon';
import type { ArcadeIconName } from './arcade/icons';
import styles from './ModeIcon.module.scss';

/** El ícono de cada tipo de minijuego (por su motor): lupa, silueta, signo de pregunta… */
export const ENGINE_ICON: Readonly<Record<string, ArcadeIconName>> = {
  classic: 'search',
  'image-reveal': 'player',
  'text-clue': 'question',
  'reveal-list': 'players',
  'higher-lower': 'sort',
  timeline: 'hourglass',
  connections: 'shuffle',
  quiz: 'question',
  'stat-builder': 'gamepad',
  'category-board': 'key-a',
};

interface ModeIconProps {
  /** El modo: si trae un ícono propio (`versusIcon`) se usa; si no, el de su motor. */
  mode: Pick<ModeConfig, 'engine' | 'versusIcon'>;
  size?: Extract<ArcadeIconSize, 'sm' | 'md' | 'lg'>;
  className?: string;
}

/**
 * El ícono de un modo en el versus: el mismo en la hoja "Agregar partida", en las tarjetas de la lista de partidas y en los grupos
 * de opciones, así se reconoce de un vistazo (la lupa del Clásico, el reloj de arena de la Línea de tiempo…). Decorativo: el nombre
 * del modo siempre va escrito al lado.
 */
export function ModeIcon({ mode, size = 'md', className }: ModeIconProps) {
  if (mode.versusIcon) {
    return (
      <img
        className={className ? `${styles.image} ${className}` : styles.image}
        data-size={size}
        src={`/img/versus/modes/${mode.versusIcon}.png`}
        alt=""
        aria-hidden="true"
        width={128}
        height={128}
        draggable={false}
        decoding="async"
      />
    );
  }
  return <ArcadeIcon name={ENGINE_ICON[mode.engine] ?? 'star'} size={size} {...(className ? { className } : {})} />;
}

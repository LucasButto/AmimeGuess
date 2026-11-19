import type { CSSProperties } from 'react';
import { LARGE_ICONS, type ArcadeIconName } from './icons';
import styles from './ArcadeIcon.module.scss';

/** Los tamaños de los íconos: chico (texto), mediano (botones y filas), grande (tarjetas) y enorme (portadas y premios). */
export type ArcadeIconSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';

interface ArcadeIconProps {
  name: ArcadeIconName;
  size?: ArcadeIconSize;
  /** Texto para lectores de pantalla. Sin él, el ícono es decorativo (`alt=""`). */
  label?: string;
  className?: string;
  /** Para colocarlo (márgenes, giros); el aspecto no se toca. */
  style?: CSSProperties;
}

const BIG: ReadonlySet<ArcadeIconSize> = new Set(['xl', 'hero']);

/**
 * Un ícono pixel art de Retro Battle, servido como archivo estático de `public/img/versus/icons/` (nunca `next/image`).
 * Con tamaño `xl` o `hero` usa la versión grande, si el ícono la tiene. Conserva la proporción del dibujo.
 */
export function ArcadeIcon({ name, size = 'md', label, className, style }: ArcadeIconProps) {
  const file = BIG.has(size) && LARGE_ICONS.has(name) ? `${name}-lg` : name;
  return (
    <img
      className={className ? `${styles.icon} ${className}` : styles.icon}
      data-size={size}
      src={`/img/versus/icons/${file}.png`}
      alt={label ?? ''}
      {...(label === undefined ? { 'aria-hidden': true } : {})}
      draggable={false}
      decoding="async"
      style={style}
    />
  );
}

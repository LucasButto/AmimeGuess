import type { CSSProperties } from 'react';
import { AVATAR_COLORS } from '../avatarColors';
import styles from './PlayerAvatar.module.scss';

/**
 * La letra del avatar de un jugador: la inicial de su apodo sin tildes ni diéresis (Á → A, Ñ → N); lo que no es una letra
 * de la A a la Z (un número, un emoji) cae en el signo de pregunta del abecedario.
 */
export function avatarKey(name: string): string {
  const first = Array.from(name.trim())[0] ?? '';
  const base = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /^[a-z]$/.test(base) ? base : 'question';
}

/** El color del avatar de un jugador (el del octógono de su letra): sirve para teñir su tarjeta y su fila. */
export function avatarColor(name: string): string {
  return AVATAR_COLORS[avatarKey(name)] ?? '#247bff';
}

interface PlayerAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** El avatar octogonal con la inicial real del jugador (abecedario arcade de `public/img/versus/alphabet/`). */
export function PlayerAvatar({ name, size = 'md', className }: PlayerAvatarProps) {
  return (
    <img
      className={className ? `${styles.avatar} ${className}` : styles.avatar}
      data-size={size}
      src={`/img/versus/alphabet/${avatarKey(name)}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ '--avatar': avatarColor(name) } as CSSProperties}
    />
  );
}

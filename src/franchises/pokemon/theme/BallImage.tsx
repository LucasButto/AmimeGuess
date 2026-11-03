import styles from './BallImage.module.scss';

/** Las bolas de la hoja aportada por el usuario (`public/theme/pokemon/balls/<nombre>.webp`). */
export type BallName = 'poke' | 'super' | 'ultra' | 'master' | 'lujo' | 'veloz' | 'ocaso' | 'premier';

/** Una bola de imagen, siempre cerrada. Es decorativa: quien la usa pone el texto. Mide lo que mide su caja, que es cuadrada. */
export function BallImage({ ball, className }: { ball: BallName; className?: string }) {
  return (
    <img className={className ? `${styles.ball} ${className}` : styles.ball} src={`/theme/pokemon/balls/${ball}.webp`} alt="" width={173} height={173}
      draggable={false} data-ball="" aria-hidden="true" />
  );
}

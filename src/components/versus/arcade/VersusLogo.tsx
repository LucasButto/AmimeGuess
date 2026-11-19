import { es } from '@/i18n/es';
import styles from './VersusLogo.module.scss';

interface VersusLogoProps {
  /** `hero`: la portada (el logo completo, con alas, ráfaga y el lema). `page`: la cabecera de las demás pantallas. */
  variant?: 'hero' | 'page';
}

/**
 * El logo "AnimeGuess VERSUS" de Retro Battle: imágenes pixel art de `public/img/versus/logo/`. En la portada, el logo
 * completo; en las demás pantallas, "AnimeGuess" chico arriba de "VERSUS".
 */
export function VersusLogo({ variant = 'page' }: VersusLogoProps) {
  if (variant === 'hero') {
    return (
      <div className={styles.logo} data-variant="hero">
        <img className={styles.full} src="/img/versus/logo/versus-full.webp" alt={es.versus.home.logoAlt} width={1931} height={692} decoding="async" fetchPriority="high" />
      </div>
    );
  }
  return (
    <div className={styles.logo} data-variant="page">
      <img className={styles.brand} src="/img/versus/logo/animeguess.webp" alt="" aria-hidden="true" width={1931} height={354} decoding="async" />
      <img className={styles.word} src="/img/versus/logo/versus.webp" alt={es.versus.home.logoAlt} width={1801} height={436} decoding="async" />
    </div>
  );
}

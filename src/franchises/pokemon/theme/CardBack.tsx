import type { ImageBackProps } from '../../types';
import styles from './CardBack.module.scss';

/**
 * Slot `ImageBack` de Pokémon: el reverso de una carta del TCG, una imagen oficial aportada por el usuario
 * (`public/theme/pokemon/card-back.webp`, ver «Archivos estáticos» en `docs/DESIGN.md`). Solo para las cartas. Es una etiqueta
 * `<img>` nativa sobre un archivo estático, como el resto de las imágenes del sitio.
 */
export function CardBack({ kind }: ImageBackProps) {
  if (kind !== 'tcg-card') return null;
  return <img className={styles.back} src="/theme/pokemon/card-back.webp" alt="" width={720} height={1014} aria-hidden="true" draggable={false} />;
}

import type { ImgHTMLAttributes } from 'react';

interface DragonBallProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'children'> {
  /** Cuántas estrellas lleva (1 a 7). */
  stars?: number;
  /** Sin brillo (la esfera de un modo pendiente se ve apagada: lo decide quien la usa con `[data-dull]`). */
  dull?: boolean;
}

/**
 * La esfera del dragón de `stars` estrellas: la imagen de la hoja de íconos de Dragon Ball
 * (`public/icons/dragon-ball/esfera-N.webp`, 1 a 7, con fondo transparente). Se escala al tamaño que le dé el CSS.
 */
export function DragonBall({ stars = 4, dull = false, ...rest }: DragonBallProps) {
  const count = Math.min(7, Math.max(1, Math.round(stars)));
  return <img src={`/icons/dragon-ball/esfera-${count}.webp`} alt="" width={188} height={188} draggable={false} aria-hidden="true" data-dull={dull} {...rest} />;
}

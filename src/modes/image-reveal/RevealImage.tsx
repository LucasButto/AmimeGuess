import type { CSSProperties } from 'react';
import { ContentImage } from '@/components/ContentImage';
import type { RevealVisual } from './logic';
import styles from './RevealImage.module.scss';

interface RevealImageProps {
  /** Ruta dentro de /public/img sin tamaño ni extensión, ver `ContentImage`. */
  stem: string;
  /** Medidas del archivo más grande: reservan el espacio y fijan la proporción del marco. */
  width: number;
  height: number;
  alt: string;
  visual: RevealVisual;
}

/**
 * La imagen del reto dentro de su marco. Lo que se ve de ella (sombra,
 * desenfoque, recorte ampliado) lo decide `visual` y se aplica con CSS sobre la
 * misma imagen nítida: no hay una versión "oculta" aparte. Son valores
 * calculados en tiempo de ejecución, por eso van como variables en el marco.
 */
export function RevealImage({ stem, width, height, alt, visual }: RevealImageProps) {
  const style = {
    '--aspect': width / height,
    '--reveal-blur': `${visual.blur}rem`,
    '--reveal-brightness': visual.brightness,
    '--reveal-gray': visual.grayscale,
    '--reveal-scale': visual.scale,
    '--reveal-x': `${visual.x}%`,
    '--reveal-y': `${visual.y}%`,
  } as CSSProperties;

  return (
    <div className={styles.frame} style={style}>
      <ContentImage
        className={styles.image}
        stem={stem}
        alt={alt}
        sizes="(min-width: 30rem) 24rem, 100vw"
        width={width}
        height={height}
        priority
      />
    </div>
  );
}

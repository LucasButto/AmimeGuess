import type { CSSProperties } from 'react';
import { VisuallyHidden } from '../VisuallyHidden';
import { bitmapSize, pixelPaths, type Bitmap } from './bitmap';
import styles from './PixelArt.module.scss';

interface PixelArtProps {
  art: Bitmap;
  /** Texto para lectores de pantalla. Sin él, el dibujo es decorativo (`aria-hidden`). */
  label?: string;
  /**
   * Cómo se mide: `px` hace que cada píxel del dibujo mida un píxel de arte (`--px`, un número entero de
   * píxeles reales); `fill` ocupa el tamaño que le dé quien lo usa (por clase).
   */
  size?: 'px' | 'fill';
  className?: string;
}

/**
 * Pixel art de interfaz (SPEC 9.2): un único `<svg>` con `shape-rendering="crispEdges"` y un `<path>` por
 * color, coloreado con variables CSS. Sin imágenes raster: se ve nítido a cualquier escala.
 */
export function PixelArt({ art, label, size = 'px', className }: PixelArtProps) {
  // Se calcula en cada render: los dibujos son chicos, y así el componente sirve también en el servidor.
  const paths = pixelPaths(art);
  const { width, height } = bitmapSize(art);
  // Medidas del dibujo en píxeles de arte: se calculan del mapa de bits (único estilo en línea).
  const box = size === 'px' ? ({ '--art-w': width, '--art-h': height } as CSSProperties) : undefined;

  return (
    <>
      <svg
        className={className ? `${styles.art} ${className}` : styles.art}
        data-size={size}
        style={box}
        viewBox={`0 0 ${width} ${height}`}
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
      >
        {paths.map(({ color, d }) => (
          // El color va en `style` porque viene de los datos del dibujo y suele ser una variable CSS.
          <path key={color} d={d} style={{ fill: color }} />
        ))}
      </svg>
      {label && <VisuallyHidden>{label}</VisuallyHidden>}
    </>
  );
}

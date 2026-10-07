// La única forma de mostrar imágenes de contenido en todo el sitio (SPEC 7,
// "Cómo se sirven"). Envuelve a la etiqueta <img> nativa sobre los archivos
// estáticos de public/img/: nunca next/image ni optimización de Vercel.
//
// Cada imagen existe en dos tamaños, `<stem>-256.webp` y `<stem>-512.webp`, que
// genera el script de datos de la franquicia. `width` y `height` reservan el
// espacio antes de que cargue, para que la página no salte.

const VARIANTS = [256, 512] as const;

interface ContentImageProps {
  /** Ruta dentro de /public/img sin tamaño ni extensión, por ejemplo `pokemon/bulbasaur`. */
  stem: string;
  alt: string;
  /** Ancho con que se muestra, para que el navegador elija el archivo (atributo `sizes`). */
  sizes: string;
  /** Medidas del archivo más grande; solo definen la proporción. Por defecto 512 × 512. */
  width?: number;
  height?: number;
  /** La imagen del reto: carga enseguida y con prioridad. El resto, en diferido. */
  priority?: boolean;
  className?: string;
}

export function ContentImage({ stem, alt, sizes, width = 512, height = 512, priority = false, className }: ContentImageProps) {
  const largest = VARIANTS[VARIANTS.length - 1];
  const srcSet = VARIANTS.map((size) => `/img/${stem}-${size}.webp ${size}w`).join(', ');

  return (
    <img
      className={className}
      src={`/img/${stem}-${largest}.webp`}
      srcSet={srcSet}
      sizes={sizes}
      width={width}
      height={height}
      alt={alt}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
    />
  );
}

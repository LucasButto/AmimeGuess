/** Dirección pública del sitio (SPEC 2, punto 1). Sirve para los links absolutos de metadatos, sitemap y robots. */
export const SITE_URL = 'https://animeguess.vercel.app';

/** Imagen para compartir en redes de cada página (archivos estáticos de public/og/, creados una sola vez). */
export function ogImage(slug: string | null): string {
  return `/og/${slug ?? 'inicio'}.png`;
}

/** Medidas de las imágenes para compartir (el estándar de Open Graph). */
export const OG_SIZE = { width: 1200, height: 630 } as const;

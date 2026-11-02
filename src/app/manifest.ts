import type { MetadataRoute } from 'next';
import { es } from '@/i18n/es';

/** El naranja del ícono (scripts/design/app-icon-source.webp): también el fondo al abrir la app instalada. */
const INK = '#fd6408';

/**
 * Manifest para instalar el sitio como app (Android y, con `appleWebApp` en el layout, iOS). Se abre sin la barra del
 * navegador; los íconos son archivos estáticos de `public/icons/` (los genera `npm run design:icons`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: es.site.name,
    short_name: es.site.name,
    description: es.site.description,
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: INK,
    theme_color: INK,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

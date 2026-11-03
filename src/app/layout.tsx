import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PREFS_BOOT_SCRIPT } from '@/components/prefs';
import { SITE_THEME_COLOR } from '@/franchises/themeColor';
import { es } from '@/i18n/es';
import '@/styles/globals.scss';
import { fontVariables } from './fonts';
import { RouteStatic } from './RouteStatic';
import { ServiceWorker } from './ServiceWorker';
import { OG_SIZE, SITE_URL, ogImage } from './site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: es.site.name, template: `%s · ${es.site.name}` },
  description: es.site.description,
  applicationName: es.site.name,
  // iOS: "Agregar a pantalla de inicio" abre sin la barra del navegador, con el nombre y el ícono de `apple-icon.png`.
  appleWebApp: { capable: true, title: es.site.name, statusBarStyle: 'black-translucent' },
  openGraph: {
    type: 'website',
    siteName: es.site.name,
    locale: 'es_AR',
    title: es.site.name,
    description: es.site.description,
    images: [{ url: ogImage(null), ...OG_SIZE, alt: es.meta.imageAlt(es.site.name) }],
  },
  twitter: { card: 'summary_large_image', title: es.site.name, description: es.site.description, images: [ogImage(null)] },
};

// viewport-fit=cover habilita env(safe-area-inset-*) en dispositivos con notch.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Android: con el teclado abierto la página se achica (y la barra de abajo queda pegada al teclado). iOS lo resuelve la barra con `visualViewport`.
  interactiveWidget: 'resizes-content',
  // El color de la barra del navegador: el naranja del ícono; cada franquicia pone el suyo (ver `[franchise]/layout.tsx`).
  themeColor: SITE_THEME_COLOR,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `suppressHydrationWarning`: el script de preferencias puede marcar <html> antes de hidratar.
    <html lang="es" className={fontVariables} suppressHydrationWarning>
      {/* El pie lo pone cada página: el de las franquicias es un slot de su piel (ver [franchise]/layout.tsx). */}
      <body>
        {/* Antes de pintar: la "Fuente legible" de las preferencias (ver prefs.ts). */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
        {children}
        <RouteStatic />
        {/* Lo ya visitado se puede jugar sin conexión (ver public/sw.js). */}
        <ServiceWorker />
      </body>
    </html>
  );
}

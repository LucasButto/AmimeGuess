import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PREFS_BOOT_SCRIPT } from '@/components/prefs';
import { es } from '@/i18n/es';
import '@/styles/globals.scss';
import { fontVariables } from './fonts';
import { RouteStatic } from './RouteStatic';
import { OG_SIZE, SITE_URL, ogImage } from './site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: es.site.name, template: `%s · ${es.site.name}` },
  description: es.site.description,
  applicationName: es.site.name,
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
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/SiteFooter';
import { es } from '@/i18n/es';
import '@/styles/globals.scss';
import { fontVariables } from './fonts';
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
    <html lang="es" className={fontVariables}>
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

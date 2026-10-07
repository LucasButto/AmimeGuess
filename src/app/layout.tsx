import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { es } from '@/i18n/es';
import '@/styles/globals.scss';

export const metadata: Metadata = {
  title: es.site.name,
  description: es.site.description,
};

// viewport-fit=cover habilita env(safe-area-inset-*) en dispositivos con notch.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

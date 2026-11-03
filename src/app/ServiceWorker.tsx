'use client';

import { useEffect } from 'react';
import { listenForInstallPrompt } from '@/components/install';

/**
 * Registra el service worker (`public/sw.js`) para que lo ya visitado se pueda jugar sin conexión. Solo en producción: en
 * desarrollo guardaría archivos viejos y confundiría. También escucha desde el principio el aviso de instalación del navegador
 * (que llega una sola vez) para ofrecerlo después en la pestaña Más. No dibuja nada.
 */
export function ServiceWorker() {
  useEffect(() => listenForInstallPrompt(), []);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Sin service worker el sitio funciona igual, solo que sin el modo sin conexión.
    });
  }, []);
  return null;
}

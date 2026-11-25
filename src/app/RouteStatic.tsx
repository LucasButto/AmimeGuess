'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { endCover, goThroughStatic, isCovering, prefersReducedMotion, settlePath, subscribeStatic } from '@/components/route-static';
import styles from './TvRoom.module.scss';

/** Lo que dura la salida de la estática (`tv-full-out`): opaca un rato y después se disipa. */
const OUT_MS = 640;

/**
 * La estática del televisor entre el inicio y lo demás (ver `route-static.ts`), en el layout raíz: no se desmonta al navegar.
 * - Un clic en un enlace al inicio, desde cualquier otra página (Inicio, la flecha de volver, la pestaña Inicio), o en un enlace
 *   del inicio marcado con `data-tv-link` (las franquicias y Versus) tapa la ventana con la estática en el acto y navega por
 *   debajo. Pasa antes que los `onClick` propios de los enlaces (la animación de salida de cada tema no corre: es un cambio de canal).
 * - Al llegar a la página nueva la estática se disipa. También al volver al inicio por otro camino (el botón atrás del navegador).
 * No hace nada en la primera carga; con movimiento reducido no hay estática. Es decorativo.
 */
export function RouteStatic() {
  const pathname = usePathname();
  const router = useRouter();
  const covering = useSyncExternalStore(subscribeStatic, isCovering, () => false);
  const [seen, setSeen] = useState(pathname);
  const [out, setOut] = useState(false);
  // Al cambiar la ruta se decide en el mismo render (sin efecto): se disipa si se venía tapando o si se llegó al inicio.
  if (seen !== pathname) {
    setSeen(pathname);
    if (covering || pathname === '/') setOut(true);
  }

  useEffect(() => {
    settlePath(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!out) return;
    endCover();
    document.body.dataset.tvLeaving = 'true';
    const timer = setTimeout(() => setOut(false), OUT_MS);
    return () => {
      clearTimeout(timer);
      delete document.body.dataset.tvLeaving;
    };
  }, [out]);

  useEffect(() => {
    if (!covering) return;
    document.body.dataset.tvLeaving = 'true';
    // Si la página nueva no llega (se levanta la estática por tiempo), la marca no queda puesta. Al llegar, la salida la vuelve a poner.
    return () => {
      delete document.body.dataset.tvLeaving;
    };
  }, [covering]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const here = window.location.pathname;
      const toHome = url.pathname === '/' && here !== '/';
      const fromHome = here === '/' && url.pathname !== '/' && link.hasAttribute('data-tv-link');
      if ((!toHome && !fromHome) || prefersReducedMotion()) return;
      event.preventDefault();
      event.stopPropagation();
      goThroughStatic((href) => router.push(href), `${url.pathname}${url.search}${url.hash}`);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  if (covering) return <span key="in" className={styles.fullStatic} data-mode="in" data-tv-full-static aria-hidden="true"><span /></span>;
  if (out) return <span key="out" className={styles.fullStatic} data-mode="out" data-tv-full-static aria-hidden="true"><span /></span>;
  return null;
}

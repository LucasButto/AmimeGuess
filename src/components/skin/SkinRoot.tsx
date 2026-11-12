'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { getSkin } from '@/franchises/themes';
import { SkinContext } from './context';
import styles from './SkinRoot.module.scss';
import { useDeparture } from './useDeparture';

interface SkinRootProps {
  /** Franquicia de las páginas que envuelve. */
  slug: string;
  children: ReactNode;
}

/**
 * Elemento raíz del tema de una franquicia (SPEC 9.2): lleva la clase de su piel, que redefine los tokens
 * semánticos para todo lo que queda adentro, y publica por contexto la piel y el propio elemento, para que
 * los portales (las ayudas ⓘ) se monten dentro del tema. El tema base (colores del config) lo aplica el
 * layout en `:root`.
 */
export function SkinRoot({ slug, children }: SkinRootProps) {
  const skin = getSkin(slug);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { PageExit } = skin.slots;

  const { departure, pending } = useDeparture(pathname);

  const animateDeparture = useCallback(
    (href: string) => {
      if (skin.pageExitMs <= 0 || href.split('?')[0] === pathname) return false;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      if (departure.start(pathname, href, skin.pageExitMs, (href) => router.push(href))) router.prefetch(href);
      return true;
    },
    [skin.pageExitMs, departure, pathname, router],
  );

  const leaveTo = useCallback((event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (plain && animateDeparture(href)) event.preventDefault();
  }, [animateDeparture]);

  const value = useMemo(() => ({ slug, skin, root, leaveTo, animateDeparture }), [slug, skin, root, leaveTo, animateDeparture]);
  const className = skin.className ? `${styles.root} ${skin.className}` : styles.root;

  return (
    <div ref={setRoot} className={className} data-theme-root="" data-skin={slug}>
      <SkinContext.Provider value={value}>
        {children}
        {pending && <PageExit />}
      </SkinContext.Provider>
    </div>
  );
}

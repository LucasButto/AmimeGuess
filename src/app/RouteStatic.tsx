'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './TvRoom.module.scss';

/**
 * Al volver a la home desde otra página del sitio, la estática del televisor cubre la ventana y se disipa, como al cambiar
 * de canal. No hace nada en la primera carga; con movimiento reducido la capa queda transparente (ver TvRoom.module.scss).
 * Es decorativo.
 */
export function RouteStatic() {
  const pathname = usePathname();
  const [seen, setSeen] = useState(pathname);
  const [show, setShow] = useState(false);
  // Al cambiar la ruta se decide en el mismo render (sin efecto): solo se muestra al llegar a la home desde otra página.
  if (seen !== pathname) {
    setSeen(pathname);
    setShow(pathname === '/');
  }
  useEffect(() => {
    if (!show) return;
    document.body.dataset.tvLeaving = 'true';
    const timer = setTimeout(() => setShow(false), 640);
    return () => {
      clearTimeout(timer);
      delete document.body.dataset.tvLeaving;
    };
  }, [show]);
  return show ? <span className={styles.fullStatic} data-mode="out" data-tv-full-static aria-hidden="true"><span /></span> : null;
}

'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ContentImage } from '@/components/ContentImage';
import { useSkin } from '@/components/skin/context';
import type { RevealVisual } from './logic';
import styles from './RevealImage.module.scss';

interface RevealImageProps {
  /** Ruta dentro de /public/img sin tamaño ni extensión, ver `ContentImage`. */
  stem: string;
  /** Medidas del archivo más grande: reservan el espacio y fijan la proporción del marco. */
  width: number;
  height: number;
  alt: string;
  visual: RevealVisual;
  /** De qué es la imagen (el `imageContentKind` del modo): si el tema le pone dorso, aparece de espaldas y se da vuelta. */
  kind?: string;
}

/** ¿Hay que pedir "reducir movimiento"? Entonces no se da vuelta: aparece directamente. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * La imagen del reto dentro de su marco. Lo que se ve de ella (sombra,
 * desenfoque, recorte ampliado) lo decide `visual` y se aplica con CSS sobre la
 * misma imagen nítida: no hay una versión "oculta" aparte. Son valores
 * calculados en tiempo de ejecución, por eso van como variables en el marco.
 *
 * Si el tema le pone dorso a este tipo de imagen (`SkinData.imageBack`, por ejemplo las cartas), el marco empieza de
 * espaldas y se da vuelta una sola vez, cuando queda a la vista (al cargar o al bajar hasta él). Solo `transform`.
 */
export function RevealImage({ stem, width, height, alt, visual, kind }: RevealImageProps) {
  const { skin } = useSkin();
  const { ImageBack } = skin.slots;
  const hasBack = kind !== undefined && skin.imageBack.includes(kind);
  const frameRef = useRef<HTMLDivElement>(null);
  // Sin dorso, con "reducir movimiento" o sin con qué saber si está a la vista, ya está de frente.
  const [faceUp, setFaceUp] = useState(() => !hasBack || prefersReducedMotion() || typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const frame = frameRef.current;
    if (faceUp || !frame) return;
    // Se da vuelta cuando se ve la mayor parte del marco; un instante después, para que se llegue a ver el dorso.
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        timer = window.setTimeout(() => setFaceUp(true), 250);
      },
      { threshold: 0.6 },
    );
    observer.observe(frame);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [faceUp]);

  const style = {
    '--aspect': width / height,
    '--reveal-blur': `${visual.blur}rem`,
    '--reveal-brightness': visual.brightness,
    '--reveal-gray': visual.grayscale,
    '--reveal-scale': visual.scale,
    '--reveal-x': `${visual.x}%`,
    '--reveal-y': `${visual.y}%`,
  } as CSSProperties;

  return (
    <div ref={frameRef} className={styles.frame} style={style} data-part="visor" data-back={hasBack} data-face-up={faceUp}>
      <div className={styles.flipper}>
        <div className={styles.front}>
          <ContentImage
            className={styles.image}
            stem={stem}
            alt={alt}
            sizes="(min-width: 30rem) 24rem, 100vw"
            width={width}
            height={height}
            priority
          />
        </div>
        {hasBack && kind !== undefined && (
          <div className={styles.back} aria-hidden="true">
            <ImageBack kind={kind} />
          </div>
        )}
      </div>
    </div>
  );
}

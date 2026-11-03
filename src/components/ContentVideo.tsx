'use client';

// La única forma de mostrar videos de contenido en todo el sitio (SPEC 7, "Videos"), igual que `ContentImage` lo es para las
// imágenes: la etiqueta <video> nativa sobre un archivo estático de public/video/, nunca hotlinking ni optimización en
// tiempo de ejecución. El clip es un MP4 sin audio de unos segundos; su póster es una imagen común de public/img/.

import { useEffect, useReducer, useRef } from 'react';
import { es } from '@/i18n/es';
import { ContentImage } from './ContentImage';
import styles from './ContentVideo.module.scss';
import { nextPlayback, showsControl, type PlaybackState } from './videoPlayback';
import { useReducedMotion } from './useReducedMotion';

interface ContentVideoProps {
  /** Ruta dentro de /public/video sin extensión, por ejemplo `naruto/989fc5b965de3f85`. */
  stem: string;
  /** Ruta del póster dentro de /public/img sin tamaño ni extensión (ver `ContentImage`). Se ve mientras carga o si el clip no anda. */
  poster: string;
  /** Qué muestra, para los lectores de pantalla. */
  alt: string;
  /** Medidas del póster más grande; solo definen la proporción. */
  width: number;
  height: number;
  /** El mismo `sizes` que `ContentImage`, para el póster. */
  sizes: string;
  /** Clase del video (y del póster de reserva): ahí van los filtros y el recorte del juego. */
  className?: string;
}

/**
 * Un clip en bucle, mudo y sin controles del navegador. Arranca solo salvo que la persona haya pedido menos movimiento: entonces
 * se ve el póster y un botón para reproducirlo. Si el navegador no deja arrancarlo (iPhone con ahorro de batería) también queda
 * el póster, con el botón. Si el archivo falla, se muestra solo el póster, como una imagen: el juego sigue igual.
 */
export function ContentVideo({ stem, poster, alt, width, height, sizes, className }: ContentVideoProps) {
  const video = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [state, dispatch] = useReducer(nextPlayback, 'idle' as PlaybackState);

  useEffect(() => {
    const element = video.current;
    if (reduced || element === null) return;
    // El atributo `autoplay` no se usa: con "menos movimiento" arrancaría antes de que se sepa. Se pide acá, ya sabiéndolo.
    element.play().catch(() => dispatch('blocked'));
  }, [reduced, stem]);

  if (state === 'failed') {
    return <ContentImage className={className} stem={poster} alt={alt} sizes={sizes} width={width} height={height} priority />;
  }

  function toggle() {
    const element = video.current;
    if (element === null) return;
    if (element.paused) element.play().catch(() => dispatch('blocked'));
    else element.pause();
  }

  const playing = state === 'playing';
  return (
    <>
      <video
        ref={video}
        className={className}
        src={`/video/${stem}.mp4`}
        poster={`/img/${poster}-512.webp`}
        width={width}
        height={height}
        aria-label={alt}
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        onPlaying={() => dispatch('playing')}
        onPause={() => dispatch('paused')}
        onError={() => dispatch('failed')}
      />
      {showsControl(state, reduced) && (
        <button type="button" className={styles.control} onClick={toggle} aria-pressed={playing}>
          {playing ? es.video.pause : es.video.play}
        </button>
      )}
    </>
  );
}

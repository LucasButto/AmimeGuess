'use client';

import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSkin } from '@/components/skin/context';
import type { BackNavIconProps } from '../../types';
import styles from './BackNavBall.module.scss';
import { BallOpen } from './BallOpen';

/**
 * Dibujo de los botones de volver de Pokémon (slot `BackNav`): "Poké Ball que se recoge". Una bola chica (la Poké Ball lleva
 * al inicio y la Master Ball a la franquicia) que se abre cuadro a cuadro con el hover y el foco (`BallOpen`). Al salir, la bola
 * se abre y la pantalla se cierra en un círculo de borde rojo que termina tragándose también la bola: queda todo negro y recién
 * ahí `BackNav` navega (600 ms, ver `backNavExitMs`); la página nueva abre sus barras desde ese negro. La página no se mueve: la tapa el iris, que va en una capa fija sobre la raíz del
 * tema. Con movimiento reducido `BackNav` navega enseguida y esto no se anima.
 */
const SIDES = ['top', 'bottom', 'left', 'right'] as const;

export function BackNavBall({ kind, leaving }: BackNavIconProps) {
  const { root } = useSkin();
  const ref = useRef<HTMLSpanElement>(null);
  const irisRef = useRef<HTMLSpanElement>(null);

  // Antes de pintar: centra el iris en la bola y calcula desde dónde se cierra (las medidas van en la capa).
  useLayoutEffect(() => {
    const wrap = ref.current;
    const iris = irisRef.current;
    if (!leaving || !wrap || !iris) return;
    // Por debajo de `lg`, con el diseño de app, la bola no se muestra: el centro es el del botón.
    const ballBox = wrap.getBoundingClientRect();
    const box = ballBox.width > 0 ? ballBox : (wrap.closest('a') ?? wrap).getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const { innerWidth: width, innerHeight: height } = window;
    // La esquina más lejana de la pantalla: hasta ahí llega el agujero al empezar.
    const far = Math.max(Math.hypot(x, y), Math.hypot(width - x, y), Math.hypot(x, height - y), Math.hypot(width - x, height - y));
    const ring = iris.firstElementChild;
    const radius = ring instanceof HTMLElement ? ring.offsetWidth / 2 : 0;
    if (radius === 0) return;
    iris.style.setProperty('--iris-x', `${x}px`);
    iris.style.setProperty('--iris-y', `${y}px`);
    iris.style.setProperty('--iris-far', `${far * 1.05}px`);
    iris.style.setProperty('--iris-from', String((far * 1.05) / radius));
  }, [leaving]);

  return (
    <span ref={ref} className={styles.wrap} data-leaving={leaving}>
      <BallOpen ball={kind === 'home' ? 'poke' : 'master'} unit="half" className={styles.ball} />
      {leaving && root && createPortal(
        <span ref={irisRef} className={styles.layer} aria-hidden="true">
          <span className={styles.ring} />
          {SIDES.map((side) => (
            <span key={side} className={styles.panel} data-side={side} />
          ))}
          <span className={styles.cover} />
        </span>,
        root,
      )}
    </span>
  );
}

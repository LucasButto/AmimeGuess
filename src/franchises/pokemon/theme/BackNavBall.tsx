'use client';

import { useEffect, useRef } from 'react';
import type { BackNavIconProps } from '../../types';
import styles from './BackNavBall.module.scss';
import { PokeBall } from './PokeBall';

/**
 * Dibujo de los botones de volver de Pokémon (slot `BackNav`): "Poké Ball que se recoge". Una bola chica
 * que se abre un poco con el hover y el foco. Al salir, un rayo rojo sale de la bola, la página se encoge
 * hacia ella a pasos y la bola se cierra; recién ahí `BackNav` navega (250 ms, ver `backNavExitMs`). Con
 * movimiento reducido `BackNav` navega enseguida y esto no se anima.
 */
export function BackNavBall({ kind, leaving }: BackNavIconProps) {
  const ref = useRef<HTMLSpanElement>(null);

  // La página se encoge hacia la bola: el centro de la animación es el de la bola, medido sobre <main>.
  useEffect(() => {
    const ball = ref.current;
    const main = ball?.closest('main');
    if (!leaving || !ball || !main) return;
    const box = ball.getBoundingClientRect();
    const page = main.getBoundingClientRect();
    main.style.setProperty('--recall-x', `${box.left - page.left + box.width / 2}px`);
    main.style.setProperty('--recall-y', `${box.top - page.top + box.height / 2}px`);
    main.setAttribute('data-recall', '');
    return () => {
      main.removeAttribute('data-recall');
      main.style.removeProperty('--recall-x');
      main.style.removeProperty('--recall-y');
    };
  }, [leaving]);

  return (
    <span ref={ref} className={styles.wrap} data-leaving={leaving}>
      {leaving && <span className={styles.ray} aria-hidden="true" />}
      <PokeBall tone={kind === 'home' ? 'blue' : 'red'} unit="half" className={styles.ball} />
    </span>
  );
}

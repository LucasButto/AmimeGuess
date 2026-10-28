'use client';

import { useEffect, useRef, useState } from 'react';
import type { AttemptsMeterProps } from '../../types';
import { es } from '@/i18n/es';
import { lifePoints, START_LP } from './gamePresentation';
import styles from './LifePoints.module.scss';

/** Conteo corto de texto, sin animar ninguna medida de layout. Se cancela al cambiar de objetivo. */
export function AnimatedPoints({ value, initial = value }: { value: number; initial?: number }) {
  const [display, setDisplay] = useState(initial);
  const current = useRef(initial);
  useEffect(() => {
    if (current.current === value) return;
    const from = current.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    let frame = 0;
    function step(now: number) {
      const progress = reduced ? 1 : Math.min(1, (now - started) / 320);
      current.current = Math.round(from + (value - from) * progress);
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span>{display}</span>;
}

/** El motor entrega los fallos reales; el medidor nunca escribe estado de juego. */
export function LifePoints({ failed, won, total }: AttemptsMeterProps) {
  const points = lifePoints(failed, total);
  const previous = useRef(failed);
  const [trap, setTrap] = useState(false);
  useEffect(() => {
    const fresh = failed > previous.current && !won;
    previous.current = failed;
    let frame = 0;
    let timer = 0;
    frame = requestAnimationFrame(() => {
      setTrap(fresh);
      if (fresh) timer = window.setTimeout(() => setTrap(false), 600);
    });
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [failed, won]);
  return <div className={styles.root} data-duel-lp={points} data-duel-trap={trap}>
    <span className={styles.meter} role="meter" aria-label={es.yugiohGames.lp} aria-valuemin={0} aria-valuemax={START_LP} aria-valuenow={points}>
      <span className={styles.reading} aria-hidden="true">{es.yugiohGames.lp} <AnimatedPoints value={points} /></span>
      <span className={styles.track} aria-hidden="true"><span style={{ transform: `scaleX(${points / START_LP})` }} /></span>
    </span>
    <span className={styles.trap} role="status" aria-live="polite">{trap ? es.yugiohGames.trap : ''}</span>
  </div>;
}

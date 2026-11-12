'use client';

import { useEffect, useState } from 'react';
import { es } from '@/i18n/es';
import { formatClock } from './format';
import type { VersusGame } from './VersusGameContext';
import styles from './VersusClock.module.scss';

/** Desde acá la cuenta regresiva cambia de color. */
const WARNING_MS = 10_000;

/**
 * El reloj de prueba de una partida de versus (la barra definitiva es de la sesión 31): en Contrarreloj, la cuenta
 * regresiva del tiempo límite; en Carrera, el tiempo total desde el inicio común; en Menos intentos, sin reloj. Arriba
 * va la modalidad y "Partida N de M".
 */
export function VersusClock({ game, frozen }: { game: VersusGame; frozen?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (frozen) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [frozen]);

  const countdown = game.modality === 'timeAttack' && game.endsAt !== undefined ? Math.max(0, game.endsAt - now) : null;
  const elapsed = game.modality === 'race' && game.raceStartedAt !== undefined ? Math.max(0, now - game.raceStartedAt) : null;
  const warning = countdown !== null && countdown <= WARNING_MS;

  return (
    <section className={styles.root} aria-label={es.versus.modality[game.modality]} data-versus-bar="" data-warning={warning || undefined}>
      <p className={styles.meta}>
        <strong>{es.versus.modality[game.modality]}</strong>
        <span>{es.versus.partidaOf(game.index, game.total)}</span>
      </p>
      {countdown !== null && (
        <p className={styles.clock}>
          <span className={styles.label}>{es.versus.timeLeft}</span>
          <time className={styles.time} role="timer" data-versus-clock="">{formatClock(countdown, 'up')}</time>
        </p>
      )}
      {elapsed !== null && (
        <p className={styles.clock}>
          <span className={styles.label}>{es.versus.elapsed}</span>
          <time className={styles.time} role="timer" data-versus-clock="">{formatClock(elapsed)}</time>
        </p>
      )}
    </section>
  );
}

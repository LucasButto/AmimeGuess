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
  const clock = game.now ?? Date.now;
  const [now, setNow] = useState(() => clock());
  useEffect(() => {
    if (frozen) return;
    const timer = window.setInterval(() => setNow(clock()), 250);
    return () => window.clearInterval(timer);
  }, [frozen, clock]);

  const countdown = game.modality === 'timeAttack' && game.endsAt !== undefined ? Math.max(0, game.endsAt - now) : null;
  const elapsed = game.modality === 'race' && game.raceStartedAt !== undefined ? Math.max(0, now - game.raceStartedAt) : null;
  // Carrera: lo que ya tardó en las partidas anteriores más lo de esta (el tiempo total corre desde el inicio común).
  const room = game.room;
  const spentBefore = room ? Object.entries(room.finishedMs).reduce((sum, [index, ms]) => (Number(index) < game.index ? sum + ms : sum), 0) : 0;
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
      {room && game.modality === 'timeAttack' && spentBefore > 0 && (
        <p className={styles.clock}>
          <span className={styles.label}>{es.versus.rivals.totalTime}</span>
          <time className={styles.time}>{formatClock(spentBefore + (game.startedAt === undefined || frozen ? 0 : Math.max(0, now - game.startedAt)))}</time>
        </p>
      )}
      {room && (
        <>
          <ul className={styles.rivals} aria-label={es.versus.rivals.label}>
            {room.players.map((player) => {
              const view = room.progress.find((item) => item.playerId === player.id);
              const gone = player.abandoned || !player.connected;
              const label = player.abandoned
                ? es.versus.rivals.abandoned
                : !player.connected
                  ? es.versus.rivals.disconnected
                  : !view || view.index === 0
                    ? es.versus.rivals.doneAll
                    : es.versus.rivals.where(Math.min(view.index, game.total), game.total);
              return (
                <li key={player.id} className={styles.rival} data-self={player.id === room.meId || undefined} data-gone={gone || undefined}>
                  <strong>{player.id === room.meId ? es.versus.rivals.you : player.name}</strong>
                  <span>{label}</span>
                </li>
              );
            })}
          </ul>
          {room.status !== 'open' && <p className={styles.offline} role="status">{room.status === 'unavailable' ? es.versus.room.unavailable : es.versus.rivals.offline}</p>}
          <ul className={styles.notices} role="status" aria-live="polite">
            {room.notices.slice(-1).map((notice, index) => (
              <li key={`${index}:${notice}`}>{notice}</li>
            ))}
          </ul>
          <button type="button" className={styles.leave} onClick={room.onLeave}>{es.versus.rivals.leave}</button>
        </>
      )}
    </section>
  );
}

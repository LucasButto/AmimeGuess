'use client';

import { useEffect } from 'react';
import { ContentImage } from '@/components/ContentImage';
import type { FinishReport } from '@/components/game-shell/types';
import { Button } from '@/components/ui/Button';
import { es } from '@/i18n/es';
import { formatClock } from './format';
import type { VersusGame } from './VersusGameContext';
import styles from './VersusSummary.module.scss';

/** El título corto del final de una partida de versus, según la modalidad y cómo terminó. */
export function summaryTitle(game: Pick<VersusGame, 'modality' | 'partida'>, report: FinishReport, elapsedMs: number | undefined): string {
  const { modality, partida } = game;
  if (report.timedOut) return es.versus.summary.timeUp(formatClock(partida.timeLimitMs ?? 0));
  if (modality !== 'fewestAttempts') {
    return report.won && elapsedMs !== undefined ? es.versus.summary.solvedIn(formatClock(elapsedMs)) : report.won ? es.versus.summary.attempts(report.attempts) : es.versus.summary.lost;
  }
  if (partida.engine === 'higher-lower') return es.versus.summary.score(report.score ?? 0);
  if (partida.engine === 'stat-builder') return es.versus.summary.scores((report.scores ?? []).map((total) => total.toLocaleString('es-AR')).join(' · '));
  return report.won ? es.versus.summary.attempts(report.attempts) : es.versus.summary.lost;
}

/**
 * Lo que se ve al terminar una partida de versus, en vez del resumen de siempre: una línea corta, la respuesta y, si
 * la sala lo ofrece, el botón para seguir.
 */
/** En una sala real, el resumen se queda unos segundos y pasa solo a la partida siguiente (el botón lo adelanta). */
const AUTO_NEXT_MS = 4_000;

export function VersusSummary({ game, report, elapsedMs }: { game: VersusGame; report: FinishReport; elapsedMs?: number }) {
  const { onNext, room } = game;
  const auto = onNext !== undefined && room !== undefined && report.fresh;
  useEffect(() => {
    if (!auto || !onNext) return;
    const timer = window.setTimeout(onNext, AUTO_NEXT_MS);
    return () => window.clearTimeout(timer);
  }, [auto, onNext]);
  return (
    <section className={styles.root} aria-live="polite" data-versus-summary="" data-won={report.won} data-timed-out={report.timedOut || undefined}>
      <h2 className={styles.title}>{summaryTitle(game, report, elapsedMs)}</h2>
      {(report.answer.label || report.answer.imageStem) && (
        <p className={styles.answer}>
          {report.answer.imageStem && <ContentImage className={styles.image} stem={report.answer.imageStem} alt="" sizes="3rem" />}
          <span>
            <span className={styles.label}>{es.versus.summary.answer}</span>{' '}
            <strong>{report.answer.label}</strong>
            {report.answer.detail && <> – {report.answer.detail}</>}
          </span>
        </p>
      )}
      {game.onNext && (
        <div>
          <Button variant="primary" onClick={game.onNext}>{es.versus.summary.next}</Button>
        </div>
      )}
    </section>
  );
}

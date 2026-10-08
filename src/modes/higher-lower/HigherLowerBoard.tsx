'use client';

import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react';
import { ContentImage } from '@/components/ContentImage';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import type { DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import styles from './HigherLowerBoard.module.scss';
import { formatMetric, progressOf, restorePicks, shareGrid, winnerOf, type Progress, type Round } from './logic';
import type { HigherLowerMetric } from './types';

interface HigherLowerBoardProps {
  /** Lo que da el marco (`GameShell`): día, filtros y el aviso de que terminó la partida. */
  session: GameSession;
  /** La métrica del día. */
  metric: HigherLowerMetric;
  /** Los pares del día, en orden. */
  rounds: readonly Round[];
}

/** El aviso al marco de que terminó la partida: el puntaje, la última ronda y la grilla para compartir. */
function reportOf(picks: readonly string[], progress: Progress, rounds: readonly Round[], metric: HigherLowerMetric, fresh: boolean): FinishReport {
  const failed = progress.failedAt !== null;
  const last = rounds[picks.length - 1];
  const winner = last ? winnerOf(last) : undefined;
  const loser = last ? (winner === last.a ? last.b : last.a) : undefined;
  const winnerValue = last && winner === last.a ? last.aValue : last?.bValue;
  const loserValue = last && winner === last.a ? last.bValue : last?.aValue;

  return {
    won: true,
    attempts: picks.length,
    score: progress.score,
    answer: {
      label:
        failed && winner && loser && winnerValue !== undefined && loserValue !== undefined
          ? es.higherLower.lastRound(
              winner.name.es,
              formatMetric(metric, winnerValue),
              loser.name.es,
              formatMetric(metric, loserValue),
            )
          : '',
      imageStem: failed ? winner?.image : undefined,
    },
    grid: shareGrid(progress.score, failed),
    fresh,
  };
}

/**
 * Una partida: los pares de un día para una combinación de filtros. El marco la
 * vuelve a montar cuando cambia cualquiera de los dos, y así recupera desde
 * `localStorage` las elecciones de esa combinación. Se juega hasta el primer
 * error; el puntaje son los aciertos seguidos.
 */
export function HigherLowerBoard({ session, metric, rounds }: HigherLowerBoardProps) {
  const { franchise, mode, filterKey, day, onFinish } = session;
  const questionId = useId();
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);

  const [picks, setPicks] = useState<string[]>(() => restorePicks(readState(getLocalStorage(), ctx)?.attempts, rounds));
  // Tras un acierto se muestran los valores de esa ronda hasta que se toca "Siguiente".
  const [awaitingNext, setAwaitingNext] = useState(false);
  const progress = progressOf(picks, rounds);
  const { ended } = progress;
  const revealed = ended || awaitingNext;
  const nextRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  // Si la partida ya había terminado al montarse (se recargó la página), el marco tiene que
  // mostrar su resumen, pero sin volver a sumarla a las estadísticas.
  const [restored] = useState<FinishReport | null>(() => (ended ? reportOf(picks, progress, rounds, metric, false) : null));
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  // La ronda que se ve: la de las elecciones hechas, o la última si se están mostrando sus valores.
  const index = revealed ? Math.max(0, picks.length - 1) : picks.length;
  const round = rounds[Math.min(index, rounds.length - 1)];
  const winner = winnerOf(round);
  const picked = picks[index];

  // El foco acompaña al juego: al elegir pasa a "Siguiente" y, al seguir, vuelve a las opciones.
  useEffect(() => {
    if (awaitingNext) nextRef.current?.focus();
  }, [awaitingNext]);
  const roundNumber = index + 1;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!revealed) firstOptionRef.current?.focus();
  }, [roundNumber, revealed]);

  function choose(id: string) {
    if (revealed) return;
    const next = [...picks, id];
    const nextProgress = progressOf(next, rounds);

    setPicks(next);
    writeState(getLocalStorage(), ctx, { attempts: next, result: nextProgress.ended ? 'won' : 'playing' });
    if (nextProgress.ended) onFinish(reportOf(next, nextProgress, rounds, metric, true));
    else setAwaitingNext(true);
  }

  const status = !revealed
    ? ''
    : picked === winner.id
      ? es.higherLower.announceCorrect(winner.name.es)
      : es.higherLower.announceWrong(winner.name.es);

  return (
    <div className={styles.root} data-game-ready="true" data-ended={ended}>
      <header className={styles.header}>
        <h2 className={styles.question} id={questionId}>
          {metric.question}
        </h2>
        <p className={styles.meta}>
          <span>{es.higherLower.roundLabel(roundNumber)}</span>
          <span className={styles.score}>{es.higherLower.score(progress.score)}</span>
        </p>
      </header>

      <div className={styles.options} role="group" aria-labelledby={questionId}>
        {([round.a, round.b] as const).map((entity, position) => (
          <Option
            key={`${index}-${entity.id}`}
            entity={entity}
            value={position === 0 ? round.aValue : round.bValue}
            metric={metric}
            revealed={revealed}
            isWinner={entity.id === winner.id}
            isPicked={entity.id === picked}
            onChoose={choose}
            buttonRef={position === 0 ? firstOptionRef : undefined}
          />
        ))}
      </div>

      {revealed && (
        <div className={styles.outcome} data-correct={picked === winner.id}>
          <p className={styles.outcomeText}>
            {ended && progress.failedAt === null
              ? es.higherLower.perfect
              : picked === winner.id
                ? es.higherLower.correct
                : es.higherLower.wrong(winner.name.es)}
          </p>
          {!ended && (
            <button type="button" className={styles.next} ref={nextRef} onClick={() => setAwaitingNext(false)}>
              {es.higherLower.next}
            </button>
          )}
        </div>
      )}

      <VisuallyHidden role="status">{status}</VisuallyHidden>
    </div>
  );
}

interface OptionProps {
  entity: Entity;
  value: number;
  metric: HigherLowerMetric;
  revealed: boolean;
  isWinner: boolean;
  isPicked: boolean;
  onChoose: (id: string) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

/** Una de las dos opciones: se toca para elegirla y, ya elegida, muestra su valor y si era la mayor. */
function Option({ entity, value, metric, revealed, isWinner, isPicked, onChoose, buttonRef }: OptionProps) {
  return (
    <button
      type="button"
      ref={buttonRef}
      className={styles.option}
      data-option="true"
      data-revealed={revealed}
      data-winner={revealed && isWinner}
      data-picked={revealed && isPicked}
      disabled={revealed}
      onClick={() => onChoose(entity.id)}
    >
      {entity.image && (
        <ContentImage className={styles.image} stem={entity.image} alt="" sizes="(min-width: 48rem) 10rem, 5rem" priority />
      )}
      <span className={styles.details}>
        <span className={styles.name}>{entity.name.es}</span>
        {revealed && <span className={styles.value}>{formatMetric(metric, value)}</span>}
        {revealed && (
          <span className={styles.badges}>
            {/* El resultado va en texto con su ícono: no depende del color. */}
            {isWinner && <span className={styles.badge} data-kind="winner">✓ {es.higherLower.higher}</span>}
            {isPicked && <span className={styles.badge} data-kind="picked">{es.higherLower.picked}</span>}
          </span>
        )}
      </span>
    </button>
  );
}

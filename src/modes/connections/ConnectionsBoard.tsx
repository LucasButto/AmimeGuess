'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import type { DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import { es } from '@/i18n/es';
import {
  isRepeat,
  judge,
  mistakesOf,
  progressOf,
  restoreAttempts,
  shareGrid,
  type Board,
  type BoardGroup,
  type Progress,
} from './logic';
import styles from './ConnectionsBoard.module.scss';
import { DIFFICULTIES, GROUP_SIZE, type ConnectionsConfig } from './types';

interface ConnectionsBoardProps {
  /** Lo que da el marco (`GameShell`): día, filtros y el aviso de que terminó el reto. */
  session: GameSession;
  config: ConnectionsConfig;
  /** Los grupos del día y cómo empiezan de desordenados los 16 elementos. */
  board: Board;
  /** Nombre visible de cada elemento del tablero, por id. */
  names: ReadonlyMap<string, string>;
}

type Feedback = 'oneAway' | 'wrong' | 'repeated';

/** El aviso al marco de que terminó el reto: los cuatro grupos, las selecciones enviadas y la grilla para compartir. */
function reportOf(attempts: readonly (readonly string[])[], board: Board, progress: Progress, fresh: boolean): FinishReport {
  return {
    won: progress.won,
    attempts: attempts.length,
    answer: { label: es.connections.answerLabel(board.groups.map((group) => group.name)) },
    grid: shareGrid(attempts, board),
    fresh,
  };
}

function difficultyName(group: BoardGroup): string {
  return es.connections.difficulties[DIFFICULTIES.indexOf(group.difficulty)] ?? '';
}

/**
 * Una partida: el tablero de un día para una combinación de filtros. El marco la vuelve a
 * montar cuando cambia cualquiera de los dos, y así recupera desde `localStorage` las
 * selecciones que se enviaron. Se tocan hasta 4 elementos y se envían: si son un grupo, se
 * revela con su nombre; si no, cuesta un error. Con 3 grupos resueltos, el cuarto queda
 * resuelto solo.
 */
export function ConnectionsBoard({ session, config, board, names }: ConnectionsBoardProps) {
  const { franchise, mode, filterKey, day, onFinish } = session;
  const missedTitleId = useId();
  const maxMistakes = mistakesOf(config);
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);

  const [attempts, setAttempts] = useState<string[][]>(() => restoreAttempts(readState(getLocalStorage(), ctx)?.attempts, board, maxMistakes));
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const progress = useMemo(() => progressOf(attempts, board, maxMistakes), [attempts, board, maxMistakes]);
  const { solved, mistakes, won, over } = progress;

  // Si el reto ya había terminado al montarse (se recargó la página), el marco tiene que mostrar
  // su resumen, pero sin volver a sumarlo a las estadísticas.
  const [restored] = useState<FinishReport | null>(() => (over ? reportOf(attempts, board, progress, false) : null));
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  // Los elementos que siguen sin grupo, en el orden del día; y, al perder, los grupos que faltaron.
  const remaining = useMemo(() => board.start.filter((id) => !solved.some((group) => group.members.includes(id))), [board, solved]);
  const missed = useMemo(() => board.groups.filter((group) => !solved.includes(group)), [board, solved]);

  const nameOf = (id: string) => names.get(id) ?? id;

  function toggle(id: string) {
    if (over) return;
    setFeedback(null);
    setSelected((current) => {
      if (current.includes(id)) return current.filter((other) => other !== id);
      return current.length < GROUP_SIZE ? [...current, id] : current;
    });
  }

  function submit() {
    if (over || selected.length !== GROUP_SIZE) return;
    if (isRepeat(selected, attempts)) {
      setFeedback('repeated');
      setAnnouncement(es.connections.repeated);
      return;
    }

    const verdict = judge(selected, missed);
    const next = [...attempts, selected];
    const nextProgress = progressOf(next, board, maxMistakes);
    setAttempts(next);
    writeState(getLocalStorage(), ctx, { attempts: next, result: nextProgress.won ? 'won' : nextProgress.over ? 'lost' : 'playing' });

    if (verdict.kind === 'correct') {
      setSelected([]);
      setFeedback(null);
      setAnnouncement(nextProgress.won ? es.connections.solvedAnnouncement : es.connections.foundAnnouncement(verdict.group.name));
    } else {
      setFeedback(verdict.kind);
      const left = maxMistakes - nextProgress.mistakes;
      setAnnouncement(
        `${verdict.kind === 'oneAway' ? es.connections.oneAway : es.connections.wrongAnnouncement(left)} ${nextProgress.over ? es.connections.lostAnnouncement : ''}`.trim(),
      );
    }
    if (nextProgress.over) onFinish(reportOf(next, board, nextProgress, true));
  }

  return (
    <div className={styles.root} data-game-ready="true" data-over={over} data-won={won}>
      <header className={styles.header}>
        <p className={styles.instructions}>{es.connections.instructions}</p>
        <p className={styles.mistakes}>
          <span className={styles.dots} aria-hidden="true">
            {Array.from({ length: maxMistakes }, (_, index) => (
              <span key={index} className={styles.dot} data-used={index < mistakes} />
            ))}
          </span>
          {es.connections.mistakes(maxMistakes - mistakes, maxMistakes)}
        </p>
      </header>

      {solved.length > 0 && (
        <ol className={styles.bands} aria-label={es.connections.solvedLabel}>
          {solved.map((group) => (
            <li key={group.id} className={styles.band} data-band="true" data-difficulty={group.difficulty}>
              <p className={styles.bandLevel}>{es.connections.difficultyLabel(difficultyName(group))}</p>
              <p className={styles.bandName}>{group.name}</p>
              <p className={styles.bandMembers}>{group.members.map(nameOf).join(', ')}</p>
            </li>
          ))}
        </ol>
      )}

      {remaining.length > 0 && !over && (
        <div className={styles.grid} role="group" aria-label={es.connections.gridLabel}>
          {remaining.map((id) => {
            const isSelected = selected.includes(id);
            return (
              <button
                key={id}
                type="button"
                className={styles.tile}
                data-tile="true"
                aria-pressed={isSelected}
                onClick={() => toggle(id)}
              >
                {nameOf(id)}
                {isSelected && (
                  <span className={styles.check} aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!over && (
        <div className={styles.actions}>
          <p className={styles.count}>{es.connections.selectedCount(selected.length, GROUP_SIZE)}</p>
          <button type="button" className={styles.submit} onClick={submit} disabled={selected.length !== GROUP_SIZE}>
            {es.connections.submit}
          </button>
          <button type="button" className={styles.clear} onClick={() => setSelected([])} disabled={selected.length === 0}>
            {es.connections.clear}
          </button>
        </div>
      )}

      <p className={styles.feedback} data-visible={feedback !== null}>
        {feedback === 'oneAway' && es.connections.oneAway}
        {feedback === 'wrong' && es.connections.wrong}
        {feedback === 'repeated' && es.connections.repeated}
      </p>

      {over && !won && (
        <section className={styles.missed} aria-labelledby={missedTitleId}>
          <h2 className={styles.missedTitle} id={missedTitleId}>
            {es.connections.unsolvedLabel}
          </h2>
          <ol className={styles.bands}>
            {missed.map((group) => (
              <li key={group.id} className={styles.band} data-band="true" data-difficulty={group.difficulty}>
                <p className={styles.bandLevel}>{es.connections.difficultyLabel(difficultyName(group))}</p>
                <p className={styles.bandName}>{group.name}</p>
                <p className={styles.bandMembers}>{group.members.map(nameOf).join(', ')}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
    </div>
  );
}

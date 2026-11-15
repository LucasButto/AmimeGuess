'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { ClueNameHover } from '@/components/game-shell/ClueNames';
import { SurrenderButton } from '@/components/game-shell/SurrenderButton';
import { useSurrender } from '@/components/game-shell/useSurrender';
import { endLimit, isUnlimited, useVersusProgress, useVersusStop } from '@/components/game-shell/versus';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { useSkin } from '@/components/skin/context';
import { useMissBuzz } from '@/components/useHaptics';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import type { DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import { es } from '@/i18n/es';
import { optionsFor, replay, shareGrid, type Question, type QuizProgress } from './logic';
import styles from './QuizBoard.module.scss';
import { DEFAULT_ATTEMPTS } from './types';

/** Lo que se necesita saber de cada opción para dibujarla: el nombre y, si lo tiene, su retrato (para el resultado). */
export interface QuizOption {
  readonly id: string;
  readonly name: string;
  readonly image?: string;
}

interface QuizBoardProps {
  /** Lo que da el marco (`GameShell`): día, filtros y el aviso de que terminó el reto. */
  session: GameSession;
  /** La pregunta del día. */
  question: Question;
  /** Cuántas opciones tiene. */
  optionCount: number;
  /** Las entidades que pueden ser opciones, por id. */
  options: ReadonlyMap<string, QuizOption>;
}

type OptionState = 'idle' | 'right' | 'wrong' | 'reveal';

/** Las opciones en un orden al azar, distinto en cada visita (Fisher-Yates con `Math.random`). */
function inRandomOrder<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let at = result.length - 1; at > 0; at--) {
    const other = Math.floor(Math.random() * (at + 1));
    [result[at], result[other]] = [result[other], result[at]];
  }
  return result;
}

/** El aviso al marco de que terminó el reto: la respuesta, los intentos y la grilla para compartir. */
function reportOf(progress: QuizProgress, answer: QuizOption, fresh: boolean): FinishReport {
  return {
    won: progress.solved,
    attempts: progress.picks.length,
    answer: { label: answer.name, imageStem: answer.image },
    grid: shareGrid(progress),
    fresh,
  };
}

/**
 * Una partida: la pregunta de un día para una combinación de filtros. El marco la vuelve a montar cuando cambia, y así
 * recupera desde `localStorage` las opciones que se eligieron. Las opciones son una grilla de nombres (la de Conexiones)
 * en un orden al azar que cambia en cada visita; al pasar el cursor por una aparece el personaje. Una opción incorrecta
 * queda descartada y cuesta un intento; con una sola respuesta (lo normal) la partida termina ahí. Al terminar se marca
 * la correcta y se muestra el dato que la explica.
 */
export function QuizBoard({ session, question, optionCount, options }: QuizBoardProps) {
  const { franchise, mode, filterKey, day, onFinish } = session;
  const { skin } = useSkin();
  const { AttemptsMeter } = skin.slots;
  const { lost: surrendered, surrender } = useSurrender(session);
  const unlimited = isUnlimited(session);
  const total = session.attemptLimit ?? DEFAULT_ATTEMPTS;
  // En versus sin límite, una opción incorrecta no termina la partida: se descarta y se sigue hasta dar con la correcta.
  const limit = endLimit(session, total);
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const optionIds = useMemo(() => optionsFor(question, optionCount, ctx), [question, optionCount, ctx]);
  // El orden en que se ven: al azar, siempre. Se mezcla una vez al montarse la partida y no se mueve mientras se juega.
  const [shownIds] = useState(() => inRandomOrder(optionIds));
  const titleId = useId();
  const factId = useId();
  const answer = options.get(question.correct) ?? { id: question.correct, name: question.correct };
  const nameOf = (id: string) => options.get(id)?.name ?? id;

  const [picks, setPicks] = useState<string[]>(() => [...replay(readState(getLocalStorage(), ctx)?.attempts, optionIds, question, limit).picks]);
  const [announcement, setAnnouncement] = useState('');
  const progress = useMemo(() => replay(picks, optionIds, question, limit), [picks, optionIds, question, limit]);
  const { solved, mistakes } = progress;
  const over = progress.over || surrendered;
  useMissBuzz(mistakes);

  // Si el reto ya había terminado al montarse (se recargó la página), el marco tiene que mostrar su resumen, pero sin
  // volver a sumarlo a las estadísticas.
  const [restored] = useState<FinishReport | null>(() => (over ? reportOf(progress, answer, false) : null));
  useVersusProgress(session, { attempts: picks.length });
  useVersusStop(session, over, (stop) => {
    if (stop === 'timeUp') surrender(picks, { ...reportOf(progress, answer, true), timedOut: true });
  });
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  function choose(id: string) {
    if (over || picks.includes(id)) return;
    const next = [...picks, id];
    const nextProgress = replay(next, optionIds, question, limit);
    setPicks(next);
    writeState(getLocalStorage(), ctx, { attempts: next, result: nextProgress.solved ? 'won' : nextProgress.over ? 'lost' : 'playing' });
    setAnnouncement(
      nextProgress.solved
        ? es.quiz.rightAnnouncement
        : nextProgress.over
          ? es.quiz.lostAnnouncement(answer.name)
          : es.quiz.wrongAnnouncement(Math.max(0, limit - next.length)),
    );
    if (nextProgress.over) onFinish(reportOf(nextProgress, answer, true));
  }

  const stateOf = (id: string): OptionState => {
    if (picks.includes(id)) return id === question.correct ? 'right' : 'wrong';
    return over && id === question.correct ? 'reveal' : 'idle';
  };
  // Con un solo intento (lo normal) no hay nada que contar; con varios o sin límite, sí.
  const counted = unlimited || total > 1;

  return (
    <div className={styles.root} data-game-ready="true" data-over={over} data-won={solved}>
      <header className={styles.header}>
        <p className={styles.instructions}>{es.quiz.instructions}</p>
        {counted && (
          <div className={styles.counter}>
            <p data-part="attempts">{unlimited ? es.versus.attempt(picks.length + (over ? 0 : 1)) : es.quiz.attempt(Math.min(picks.length + 1, total), total)}</p>
            {!unlimited && <AttemptsMeter failed={mistakes} won={solved} total={total} />}
            {!over && <SurrenderButton onConfirm={() => surrender(picks, reportOf(progress, answer, true))} />}
          </div>
        )}
      </header>

      <section className={styles.card} aria-labelledby={titleId} data-part="quiz-card">
        <h2 className={styles.question} id={titleId}>
          {question.text}
        </h2>
        {/* De qué parte de la historia habla la pregunta (serie, saga, episodio): debajo de ella y arriba de las opciones. */}
        {question.scope && <p className={styles.scope}>{question.scope}</p>}
        <div className={styles.grid} role="group" aria-label={es.quiz.gridLabel} data-count={optionIds.length}>
          {shownIds.map((id) => {
            const state = stateOf(id);
            const blocked = over || picks.includes(id);
            return (
              <div key={id} className={styles.cell}>
                <button type="button" className={styles.tile} data-tile="true" data-state={state} disabled={blocked} onClick={() => choose(id)}>
                  {nameOf(id)}
                  {state !== 'idle' && <VisuallyHidden>{` (${state === 'wrong' ? es.quiz.stateWrong : state === 'reveal' ? es.quiz.stateReveal : es.quiz.stateRight})`}</VisuallyHidden>}
                </button>
                <ClueNameHover text={nameOf(id)} />
              </div>
            );
          })}
        </div>
      </section>

      {over && question.explanation && (
        <section className={styles.fact} aria-labelledby={factId} data-part="quiz-fact" data-right={solved}>
          <h2 className={styles.factTitle} id={factId}>
            {es.quiz.factTitle}
          </h2>
          <p>{question.explanation}</p>
        </section>
      )}

      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
    </div>
  );
}

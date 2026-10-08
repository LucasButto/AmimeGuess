'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Autocomplete, type AutocompleteItem } from '@/components/Autocomplete';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { pickDaily, type DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import {
  failedCount,
  isCorrect,
  lineStates,
  pickContent,
  restoreAttempts,
  shareGrid,
  winningAttempt,
  type Candidate,
} from './logic';
import styles from './TextClueBoard.module.scss';
import type { TextClueConfig } from './types';

interface TextClueBoardProps {
  /** Lo que da el marco (`GameShell`): día, filtros y el aviso de que terminó el reto. */
  session: GameSession;
  config: TextClueConfig;
  /** Las respuestas posibles con las series activas. */
  candidates: readonly Candidate[];
  /** Todo lo que se puede intentar con las series activas. */
  options: readonly Entity[];
}

/** El aviso al marco de que terminó el reto: quién acertó, los intentos y la grilla para compartir. */
function reportOf(attemptIds: readonly string[], winner: Entity, fresh: boolean): FinishReport {
  return {
    won: true,
    attempts: attemptIds.length,
    // Si acertó con una respuesta equivalente, esa es la que se muestra: es la que escribió.
    answer: { label: winner.name.es, imageStem: winner.image },
    grid: shareGrid(attemptIds, winner.id),
    fresh,
  };
}

/**
 * Una partida: el reto de un día para una combinación de filtros. El marco la
 * vuelve a montar cuando cambia cualquiera de los dos, y así recupera desde
 * `localStorage` los intentos de esa combinación.
 */
export function TextClueBoard({ session, config, candidates, options }: TextClueBoardProps) {
  const { franchise, mode, filterKey, day, onFinish } = session;
  const clueTitleId = useId();
  const hintsTitleId = useId();
  const failedTitleId = useId();
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const answer = useMemo(() => pickDaily(candidates, ctx), [candidates, ctx]);
  const content = useMemo(() => pickContent(answer, ctx), [answer, ctx]);
  const byId = useMemo(() => new Map(options.map((entity) => [entity.id, entity])), [options]);

  const [attemptIds, setAttemptIds] = useState<string[]>(() =>
    restoreAttempts(readState(getLocalStorage(), ctx)?.attempts, options),
  );
  const [lastAttempt, setLastAttempt] = useState<string | null>(null);

  const winnerId = winningAttempt(attemptIds, answer.id, content);
  const won = winnerId !== null;

  // Si la partida ya estaba ganada al montarse (se recargó la página), el marco tiene que
  // mostrar su resumen, pero sin volver a sumarla a las estadísticas.
  const [restored] = useState<FinishReport | null>(() => {
    const winner = winnerId === null ? undefined : byId.get(winnerId);
    return winner ? reportOf(attemptIds, winner, false) : null;
  });
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  const attempted = useMemo(() => new Set(attemptIds), [attemptIds]);
  const failed = failedCount(attemptIds, answer.id, content);

  const items = useMemo<AutocompleteItem[]>(
    () => options.map((entity) => ({ id: entity.id, label: entity.name.es, aliases: entity.aliases, imageStem: entity.image })),
    [options],
  );

  // Al acertar se muestran todas las pistas.
  const states = useMemo(
    () => lineStates(config.lines, won ? Infinity : failed, answer.entity, content),
    [config.lines, won, failed, answer.entity, content],
  );
  const mainLines = states.filter((state) => state.line.after === 0);
  const hintLines = states.filter((state) => state.line.after > 0);

  // Del más reciente al más antiguo: lo último que se probó queda arriba.
  const failedNames = useMemo(
    () =>
      attemptIds
        .filter((id) => !isCorrect(id, answer.id, content))
        .flatMap((id) => {
          const entity = byId.get(id);
          return entity ? [{ id, label: entity.name.es }] : [];
        })
        .reverse(),
    [attemptIds, answer.id, content, byId],
  );

  function addAttempt(id: string) {
    if (won || attempted.has(id)) return;
    const guess = byId.get(id);
    if (!guess) return;
    const next = [...attemptIds, id];
    const solved = isCorrect(id, answer.id, content);

    setAttemptIds(next);
    setLastAttempt(id);
    writeState(getLocalStorage(), ctx, { attempts: next, result: solved ? 'won' : 'playing' });

    if (solved) onFinish(reportOf(next, guess, true));
  }

  const lastName = lastAttempt && !isCorrect(lastAttempt, answer.id, content) ? byId.get(lastAttempt)?.name.es : undefined;

  return (
    <div className={styles.root} data-game-ready="true" data-won={won}>
      {/* Al ganar, el marco muestra la respuesta y el resumen (ver `FinishReport`). */}
      {!won && <Autocomplete label={es.textClue.inputLabel} items={items} excludeIds={attempted} onSelect={addAttempt} />}

      <section className={styles.clue} aria-labelledby={clueTitleId}>
        <h2 className={styles.clueTitle} id={clueTitleId}>
          {es.textClue.clueTitle}
        </h2>
        {mainLines.map(({ line, text }) => (
          <div key={line.label} className={styles.clueLine}>
            <p className={styles.clueLabel}>{line.label}</p>
            <p className={styles.clueText} data-display={line.kind === 'content' ? (line.display ?? 'text') : 'text'}>
              {text}
            </p>
          </div>
        ))}
      </section>

      {hintLines.length > 0 && (
        <section className={styles.hints} aria-labelledby={hintsTitleId}>
          <h2 className={styles.hintsTitle} id={hintsTitleId}>
            {es.textClue.hintsTitle}
          </h2>
          <ul className={styles.hintList}>
            {hintLines.map(({ line, unlocked, remaining, text }) => (
              <li key={line.label} className={styles.hint} data-unlocked={unlocked}>
                <span className={styles.hintLabel}>{line.label}</span>
                <span>{unlocked ? text : es.textClue.hintLocked(remaining)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.counter}>{es.textClue.attempts(attemptIds.length)}</p>

      {failedNames.length > 0 && (
        <section className={styles.failed} aria-labelledby={failedTitleId}>
          <h2 className={styles.failedTitle} id={failedTitleId}>
            {es.textClue.failedTitle}
          </h2>
          <ul className={styles.chips}>
            {failedNames.map((attempt) => (
              <li key={attempt.id} className={styles.chip}>
                {/* La cruz acompaña al color: el fallo no depende de verlo en rojo. */}
                <span aria-hidden="true">✕</span> {attempt.label}
              </li>
            ))}
          </ul>
        </section>
      )}
      {failedNames.length === 0 && !won && <p className={styles.empty}>{es.textClue.empty}</p>}

      <VisuallyHidden role="status">{lastName ? es.textClue.wrongAttempt(lastName) : ''}</VisuallyHidden>
    </div>
  );
}

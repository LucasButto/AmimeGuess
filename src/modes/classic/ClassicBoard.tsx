'use client';

import { useId, useMemo, useState } from 'react';
import { Autocomplete, type AutocompleteItem } from '@/components/Autocomplete';
import { ContentImage } from '@/components/ContentImage';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { pickDaily, type DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Content, Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { AttemptsTable } from './AttemptsTable';
import styles from './ClassicBoard.module.scss';
import { buildRow, failedCount, hintStates, hintText, restoreAttempts } from './logic';
import type { ClassicColumn, ClassicHint } from './types';

interface ClassicBoardProps {
  franchise: string;
  mode: string;
  filterKey: string;
  day: number;
  /** Entidades elegibles con las series activas. */
  pool: readonly Entity[];
  active: readonly string[];
  columns: readonly ClassicColumn[];
  hints: readonly ClassicHint[];
  contents: readonly Content[];
}

/**
 * Una partida: el reto de un día para una combinación de filtros. Se vuelve a
 * montar (con `key`) cuando cambia cualquiera de los dos, y así recupera desde
 * `localStorage` los intentos de esa combinación.
 */
export function ClassicBoard({ franchise, mode, filterKey, day, pool, active, columns, hints, contents }: ClassicBoardProps) {
  const hintsTitleId = useId();
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const answer = useMemo(() => pickDaily(pool, ctx), [pool, ctx]);
  const byId = useMemo(() => new Map(pool.map((entity) => [entity.id, entity])), [pool]);

  const [attemptIds, setAttemptIds] = useState<string[]>(() =>
    restoreAttempts(readState(getLocalStorage(), ctx)?.attempts, pool),
  );
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const attempted = useMemo(() => new Set(attemptIds), [attemptIds]);
  const lastName = lastAdded ? byId.get(lastAdded)?.name.es : undefined;
  const won = attempted.has(answer.id);
  const failed = failedCount(attemptIds, answer.id);

  const items = useMemo<AutocompleteItem[]>(
    () => pool.map((entity) => ({ id: entity.id, label: entity.name.es, aliases: entity.aliases, imageStem: entity.image })),
    [pool],
  );

  // Del más reciente al más antiguo: lo último que se probó queda arriba, junto al campo.
  const rows = useMemo(
    () =>
      attemptIds
        .flatMap((id) => {
          const entity = byId.get(id);
          return entity ? [buildRow(entity, answer, columns, active)] : [];
        })
        .reverse(),
    [attemptIds, byId, answer, columns, active],
  );

  const visibleHints = useMemo(
    () =>
      hintStates(hints, failed).flatMap((state) => {
        const text = hintText(state.hint, answer, contents);
        // Una pista cuyo dato no existe para esta respuesta no se muestra: ni bloqueada ni abierta.
        return text === null ? [] : [{ ...state, text }];
      }),
    [hints, failed, answer, contents],
  );

  function addAttempt(id: string) {
    if (won || attempted.has(id) || !byId.has(id)) return;
    const next = [...attemptIds, id];
    setAttemptIds(next);
    setLastAdded(id);
    writeState(getLocalStorage(), ctx, { attempts: next, result: next.includes(answer.id) ? 'won' : 'playing' });
  }

  return (
    <div className={styles.root} data-game-ready="true">
      {won ? (
        <section className={styles.win} aria-live="polite">
          {answer.image && (
            <ContentImage className={styles.winImage} stem={answer.image} alt="" sizes="(min-width: 48rem) 10rem, 8rem" priority />
          )}
          <div>
            <h2 className={styles.winTitle}>{es.classic.wonTitle}</h2>
            <p>{es.classic.wonText(answer.name.es, attemptIds.length)}</p>
          </div>
        </section>
      ) : (
        <Autocomplete label={es.classic.inputLabel} items={items} excludeIds={attempted} onSelect={addAttempt} />
      )}

      {!won && visibleHints.length > 0 && (
        <section className={styles.hints} aria-labelledby={hintsTitleId}>
          <h2 className={styles.hintsTitle} id={hintsTitleId}>
            {es.classic.hintsTitle}
          </h2>
          <ul className={styles.hintList}>
            {visibleHints.map(({ hint, unlocked, remaining, text }) => (
              <li key={hint.label} className={styles.hint} data-unlocked={unlocked}>
                <span className={styles.hintLabel}>{hint.label}</span>
                <span>{unlocked ? text : es.classic.hintLocked(remaining)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.counter}>{es.classic.attempts(attemptIds.length)}</p>

      {rows.length > 0 ? <AttemptsTable rows={rows} columns={columns} /> : <p className={styles.empty}>{es.classic.empty}</p>}

      <VisuallyHidden role="status">{lastName ? es.classic.lastAttempt(lastName) : ''}</VisuallyHidden>
    </div>
  );
}

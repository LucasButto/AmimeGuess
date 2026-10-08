'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Autocomplete, type AutocompleteItem } from '@/components/Autocomplete';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { pickDaily, type DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Content, Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { AttemptsTable } from './AttemptsTable';
import styles from './ClassicBoard.module.scss';
import { buildRow, failedCount, hintStates, hintText, restoreAttempts, shareGrid, type AttemptRow } from './logic';
import type { ClassicColumn, ClassicHint } from './types';

interface ClassicBoardProps {
  /** Lo que da el marco (`GameShell`): día, filtros y el aviso de que terminó el reto. */
  session: GameSession;
  /** Entidades elegibles con las series activas. */
  pool: readonly Entity[];
  columns: readonly ClassicColumn[];
  hints: readonly ClassicHint[];
  contents: readonly Content[];
}

/** Las filas de los intentos, en el orden en que se jugaron. */
function rowsOf(
  ids: readonly string[],
  byId: ReadonlyMap<string, Entity>,
  answer: Entity,
  columns: readonly ClassicColumn[],
  active: readonly string[],
): AttemptRow[] {
  return ids.flatMap((id) => {
    const entity = byId.get(id);
    return entity ? [buildRow(entity, answer, columns, active)] : [];
  });
}

/** El aviso al marco de que terminó el reto: la respuesta, los intentos y la grilla para compartir. */
function reportOf(
  ids: readonly string[],
  byId: ReadonlyMap<string, Entity>,
  answer: Entity,
  columns: readonly ClassicColumn[],
  active: readonly string[],
  fresh: boolean,
): FinishReport {
  return {
    won: true,
    attempts: ids.length,
    answer: { label: answer.name.es, imageStem: answer.image },
    grid: shareGrid(rowsOf(ids, byId, answer, columns, active)),
    fresh,
  };
}

/**
 * Una partida: el reto de un día para una combinación de filtros. El marco la
 * vuelve a montar cuando cambia cualquiera de los dos, y así recupera desde
 * `localStorage` los intentos de esa combinación.
 */
export function ClassicBoard({ session, pool, columns, hints, contents }: ClassicBoardProps) {
  const { franchise, mode, filterKey, day, active, onFinish } = session;
  const hintsTitleId = useId();
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const answer = useMemo(() => pickDaily(pool, ctx), [pool, ctx]);
  const byId = useMemo(() => new Map(pool.map((entity) => [entity.id, entity])), [pool]);

  const [attemptIds, setAttemptIds] = useState<string[]>(() =>
    restoreAttempts(readState(getLocalStorage(), ctx)?.attempts, pool),
  );
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  // Si la partida ya estaba ganada al montarse (se recargó la página), el marco tiene que
  // mostrar su resumen, pero sin volver a sumarla a las estadísticas.
  const [restored] = useState<FinishReport | null>(() =>
    attemptIds.includes(answer.id) ? reportOf(attemptIds, byId, answer, columns, active, false) : null,
  );
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

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
    () => rowsOf(attemptIds, byId, answer, columns, active).reverse(),
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
    const solved = next.includes(answer.id);

    setAttemptIds(next);
    setLastAdded(id);
    writeState(getLocalStorage(), ctx, { attempts: next, result: solved ? 'won' : 'playing' });

    if (solved) onFinish(reportOf(next, byId, answer, columns, active, true));
  }

  return (
    <div className={styles.root} data-game-ready="true">
      {/* Al ganar, el marco muestra la respuesta y el resumen (ver `FinishReport`). */}
      {!won && <Autocomplete label={es.classic.inputLabel} items={items} excludeIds={attempted} onSelect={addAttempt} />}

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

'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { autocompleteItemOf, type AutocompleteItem } from '@/components/Autocomplete';
import { GuessField } from '@/components/GuessField';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { useSkin } from '@/components/skin/context';
import { useSound } from '@/components/skin/useSound';
import { InfoTip } from '@/components/ui/InfoTip';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { pickDaily, type DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Content, Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { AttemptsTable } from './AttemptsTable';
import styles from './ClassicBoard.module.scss';
import { buildRow, failedCount, hintStates, hintText, restoreAttempts, rowSummary, shareGrid, type AttemptRow } from './logic';
import { parseCssTime, reducedRevealTiming, revealTiming, type RevealTiming } from './reveal';
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

/** Margen del temporizador de respaldo por si la última celda nunca avisa que terminó (pestaña dormida, etc.). */
const FALLBACK_MARGIN_MS = 400;

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

/** Los tiempos de la revelación con la duración y el desfase del tema (variables CSS del elemento). */
function timingFor(element: HTMLElement | null, columns: number): RevealTiming {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return reducedRevealTiming(columns);
  const style = element ? getComputedStyle(element) : null;
  const duration = parseCssTime(style?.getPropertyValue('--flip-duration') ?? '', 450);
  const stagger = parseCssTime(style?.getPropertyValue('--flip-stagger') ?? '', 280);
  return revealTiming(columns, duration, stagger);
}

/**
 * Una partida: el reto de un día para una combinación de filtros. El marco la
 * vuelve a montar cuando cambia cualquiera de los dos, y así recupera desde
 * `localStorage` los intentos de esa combinación.
 *
 * Cada intento se guarda al instante y su fila se revela columna por columna (SPEC 9.2). El aviso de
 * victoria, las estadísticas y el texto para compartir llegan recién al terminar la revelación. El campo de
 * texto nunca se bloquea: un intento nuevo deja la fila anterior en su estado final y empieza la suya.
 */
export function ClassicBoard({ session, pool, columns, hints, contents }: ClassicBoardProps) {
  const { franchise, mode, filterKey, day, active, onFinish } = session;
  const hintsTitleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { skin } = useSkin();
  const { ModeFrame, AttemptsMeter } = skin.slots;
  const play = useSound();
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const answer = useMemo(() => pickDaily(pool, ctx), [pool, ctx]);
  const byId = useMemo(() => new Map(pool.map((entity) => [entity.id, entity])), [pool]);

  const [attemptIds, setAttemptIds] = useState<string[]>(() =>
    restoreAttempts(readState(getLocalStorage(), ctx)?.attempts, pool),
  );
  const [revealing, setRevealing] = useState<{ id: string; timing: RevealTiming } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // La victoria se le avisa al marco y la fila se resume al terminar la revelación.
  const pendingFinish = useRef<FinishReport | null>(null);
  const pendingAnnouncement = useRef('');
  const fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // El id de la fila que se revela, para que el fin de una revelación vieja no corte la nueva.
  const revealingId = useRef<string | null>(null);
  useEffect(() => {
    revealingId.current = revealing?.id ?? null;
  }, [revealing]);

  // Si la partida ya estaba ganada al montarse (se recargó la página), el marco tiene que
  // mostrar su resumen, pero sin volver a sumarla a las estadísticas.
  const [restored] = useState<FinishReport | null>(() =>
    attemptIds.includes(answer.id) ? reportOf(attemptIds, byId, answer, columns, active, false) : null,
  );
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  const attempted = useMemo(() => new Set(attemptIds), [attemptIds]);
  const won = attempted.has(answer.id);
  const failed = failedCount(attemptIds, answer.id);

  const items = useMemo<AutocompleteItem[]>(
    () => pool.map(autocompleteItemOf),
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

  /** Termina la revelación de la fila `id` (o la que esté en curso): resume la fila y, si ganó, avisa al marco. */
  const finishReveal = useCallback(
    (id?: string) => {
      clearTimeout(fallback.current);
      setRevealing((current) => (current === null || (id !== undefined && current.id !== id) ? current : null));
      const finish = pendingFinish.current;
      pendingFinish.current = null;
      if (finish) onFinish(finish);
    },
    [onFinish],
  );

  // Si la pestaña se oculta en plena revelación, termina enseguida: el navegador frena las animaciones.
  useEffect(() => {
    if (revealing === null) return;
    const onHide = () => {
      if (document.hidden) finishReveal();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [revealing, finishReveal]);

  useEffect(() => () => clearTimeout(fallback.current), []);

  function addAttempt(id: string) {
    if (won || attempted.has(id) || !byId.has(id)) return;
    const next = [...attemptIds, id];
    const solved = next.includes(answer.id);
    const entity = byId.get(id);

    // El intento se guarda antes de la animación: recargar a mitad de la revelación muestra la fila completa.
    setAttemptIds(next);
    writeState(getLocalStorage(), ctx, { attempts: next, result: solved ? 'won' : 'playing' });

    // Una revelación en curso termina acá: su fila queda en su estado final.
    finishReveal();
    const timing = timingFor(rootRef.current, columns.length);
    const summary = entity ? rowSummary(buildRow(entity, answer, columns, active)) : '';
    const report = solved ? reportOf(next, byId, answer, columns, active, true) : null;
    // El resumen de la fila llega al final, en un único aviso.
    setAnnouncement('');

    if (document.hidden || timing.total === 0) {
      setAnnouncement(summary);
      if (report) onFinish(report);
      return;
    }

    pendingFinish.current = report;
    pendingAnnouncement.current = summary;
    revealingId.current = id;
    setRevealing({ id, timing });
    // Un blip por celda al darse vuelta y, si no acertó, un tono bajo al final (si "Sonidos" está activo).
    timing.delays.forEach((delay) => play('reveal', delay + timing.duration / 2));
    if (!solved) play('miss', timing.total);
    fallback.current = setTimeout(() => endReveal(id), timing.total + FALLBACK_MARGIN_MS);
  }

  /** Fin de la revelación de la fila `id`: por la última celda o por el temporizador de respaldo. */
  function endReveal(id: string) {
    if (revealingId.current !== id) return;
    revealingId.current = null;
    setAnnouncement(pendingAnnouncement.current);
    finishReveal(id);
  }

  return (
    <div ref={rootRef} className={styles.root} data-game-ready="true">
      {/* El intento y las pistas, uno al lado del otro (apilados en un teléfono). Al ganar, el marco muestra la
          respuesta y el resumen (ver `FinishReport`) y esto queda vacío. */}
      <div className={styles.top} data-split={!won && visibleHints.length > 0}>
        {!won && <GuessField label={es.classic.inputLabel} items={items} excludeIds={attempted} onSelect={addAttempt} />}

        {!won && visibleHints.length > 0 && (
          <section className={styles.hints} aria-labelledby={hintsTitleId}>
            <div className={styles.titleRow}>
              <h2 className={styles.hintsTitle} id={hintsTitleId}>
                {es.classic.hintsTitle}
              </h2>
              <InfoTip compact text={es.help.hints} label={es.help.button(es.classic.hintsTitle)} />
            </div>
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
      </div>

      <div className={styles.counter}>
        <p>{es.classic.attempts(attemptIds.length)}</p>
        <AttemptsMeter failed={failed} won={won} />
      </div>

      <ModeFrame mode={mode} engine="classic">
        {rows.length > 0 ? (
          <AttemptsTable rows={rows} columns={columns} revealing={revealing} onRevealEnd={endReveal} />
        ) : (
          <p className={styles.empty}>{es.classic.empty}</p>
        )}
      </ModeFrame>

      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
    </div>
  );
}

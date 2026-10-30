'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { autocompleteItemOf, type AutocompleteItem } from '@/components/Autocomplete';
import { GuessField } from '@/components/GuessField';
import { SurrenderButton } from '@/components/game-shell/SurrenderButton';
import { useSurrender } from '@/components/game-shell/useSurrender';
import { fitHints, restoreLimited } from '@/components/game-shell/attempts';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { useSkin } from '@/components/skin/context';
import { SkinAttemptsMeter, SkinGameFrame, SkinRevealListItem, revealListPosition } from '@/components/skin/gameSlots';
import { PixelIcon } from '@/components/ui/icons';
import { InfoTip } from '@/components/ui/InfoTip';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { pickDaily, type DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import {
  failedCount,
  isCorrect,
  itemsOf,
  lineStates,
  pickContent,
  restoreAttempts,
  shareGrid,
  slotsOf,
  winningAttempt,
  type Candidate,
} from './logic';
import styles from './RevealListBoard.module.scss';
import type { RevealListConfig } from './types';

interface RevealListBoardProps {
  /** Lo que da el marco (`GameShell`): día, filtros y el aviso de que terminó el reto. */
  session: GameSession;
  config: RevealListConfig;
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
export function RevealListBoard({ session, config, candidates, options }: RevealListBoardProps) {
  const { franchise, mode, filterKey, day, onFinish } = session;
  const maxAttempts = session.attemptLimit ?? 8;
  const { lost: surrendered, surrender } = useSurrender(session);
  const listTitleId = useId();
  const hintsTitleId = useId();
  const failedTitleId = useId();
  const { skin } = useSkin();
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const answer = useMemo(() => pickDaily(candidates, ctx), [candidates, ctx]);
  const content = useMemo(() => pickContent(answer, ctx), [answer, ctx]);
  const items = useMemo(() => itemsOf(content, config.field), [content, config.field]);
  const byId = useMemo(() => new Map(options.map((entity) => [entity.id, entity])), [options]);

  const [attemptIds, setAttemptIds] = useState<string[]>(() => {
    const state = readState(getLocalStorage(), ctx);
    return restoreLimited(restoreAttempts(state?.attempts, options), state, maxAttempts);
  });
  const [lastAttempt, setLastAttempt] = useState<{ id: string; revealed: boolean } | null>(null);

  const winnerId = winningAttempt(attemptIds, answer.id, content);
  const won = winnerId !== null;
  const over = won || surrendered || attemptIds.length >= maxAttempts;

  // Si la partida ya estaba ganada al montarse (se recargó la página), el marco tiene que
  // mostrar su resumen, pero sin volver a sumarla a las estadísticas.
  const [restored] = useState<FinishReport | null>(() => {
    const winner = winnerId === null ? undefined : byId.get(winnerId);
    return winner ? reportOf(attemptIds, winner, false) : over ? { ...reportOf(attemptIds, answer.entity, false), won: false } : null;
  });
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  const attempted = useMemo(() => new Set(attemptIds), [attemptIds]);
  const failed = failedCount(attemptIds, answer.id, content);

  const autocompleteItems = useMemo<AutocompleteItem[]>(
    () => options.map(autocompleteItemOf),
    [options],
  );

  // Al acertar se muestran todas las pistas.
  const slots = useMemo(() => slotsOf(items, over ? Infinity : failed, config.initial), [items, over, failed, config.initial]);
  const hiddenCount = slots.filter((slot) => !slot.revealed).length;
  // Las pistas sobre la propia respuesta (sus tipos, su inicial…), si la configuración las tiene.
  const hintLines = useMemo(
    () => lineStates(fitHints(config.hints ?? [], maxAttempts), over ? Infinity : failed, answer.entity, content),
    [config.hints, maxAttempts, over, failed, answer.entity, content],
  );
  // ¿El último fallo acaba de desbloquear una pista? El tema puede avisarlo (un ▼ que parpadea, como en los juegos).
  const newHint = !over && failed > 0 && hintLines.some((state) => state.line.after === failed);

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
    if (over || attempted.has(id)) return;
    const guess = byId.get(id);
    if (!guess) return;
    const next = [...attemptIds, id];
    const solved = isCorrect(id, answer.id, content);

    setAttemptIds(next);
    setLastAttempt({ id, revealed: hiddenCount > 0 });
    const spent = !solved && next.length >= maxAttempts;
    writeState(getLocalStorage(), ctx, { attempts: next, result: solved ? 'won' : spent ? 'lost' : 'playing' });

    if (solved || spent) onFinish({ ...reportOf(next, solved ? guess : answer.entity, true), won: solved });
  }

  const lastName = lastAttempt && !isCorrect(lastAttempt.id, answer.id, content) ? byId.get(lastAttempt.id)?.name.es : undefined;
  // La pista que acaba de revelar el último intento: el tema puede señalarla (un cursor ▶, como en un menú).
  const latest = lastAttempt?.revealed ? Math.max(0, ...slots.filter((slot) => slot.revealed).map((slot) => slot.position)) : 0;

  return (
    <div className={styles.root} data-game-ready="true" data-won={won} data-over={over} data-hints={hintLines.length > 0}>
      {/* Al ganar, el marco muestra la respuesta y el resumen (ver `FinishReport`). */}
      {!over && (
        <div className={styles.field}>
          <GuessField label={es.revealList.inputLabel} items={autocompleteItems} excludeIds={attempted} onSelect={addAttempt} />
        </div>
      )}

      <SkinGameFrame skin={skin} mode={mode} engine="reveal-list">
        <section className={styles.list} aria-labelledby={listTitleId}>
          <h2 className={styles.listTitle} id={listTitleId}>
            {config.label}
          </h2>
          <ol className={styles.slots}>
            {slots.map((slot) => (
              <li key={slot.position} className={styles.slot} data-revealed={slot.revealed} data-latest={slot.position === latest}>
                <SkinRevealListItem skin={skin} position={slot.position} revealed={slot.revealed} text={slot.revealed ? slot.text : undefined}>
                  <span className={styles.cursor} aria-hidden="true">
                    <PixelIcon name="cursor" />
                  </span>
                  <span className={styles.position} aria-hidden="true">
                    {revealListPosition(slot.position, skin.revealListPositionPrefix)}
                  </span>
                  {slot.revealed ? (
                    <span className={styles.text}>{slot.text}</span>
                  ) : (
                    <>
                      {/* Un hueco por revelar: se ve como "???" y se lee como "todavía oculta". */}
                      <span className={styles.text} aria-hidden="true">
                        ???
                      </span>
                      <VisuallyHidden>{`${es.revealList.position(slot.position)}: ${es.revealList.hidden}`}</VisuallyHidden>
                    </>
                  )}
                </SkinRevealListItem>
              </li>
            ))}
          </ol>
        </section>
      </SkinGameFrame>

      {hintLines.length > 0 && (
        <section className={styles.hints} aria-labelledby={hintsTitleId} data-new-hint={newHint}>
          <div className={styles.titleRow}>
            <h2 className={styles.hintsTitle} id={hintsTitleId}>
              {es.revealList.hintsTitle}
            </h2>
            <InfoTip compact text={es.help.hints} label={es.help.button(es.revealList.hintsTitle)} />
          </div>
          <ul className={styles.hintList}>
            {hintLines.map(({ line, unlocked, remaining, text }) => (
              <li key={line.label} className={styles.hint} data-unlocked={unlocked}>
                <span className={styles.hintLabel}>{line.label}</span>
                <span>{unlocked ? text : es.revealList.hintLocked(remaining)}</span>
              </li>
            ))}
          </ul>
          {newHint && (
            <span className={styles.more} aria-hidden="true">
              <PixelIcon name="more" />
            </span>
          )}
        </section>
      )}

      <div className={styles.counter}>
        <p>{es.shell.limits.counter(attemptIds.length, maxAttempts)}</p>
        {!over && (
          <SurrenderButton
            onConfirm={() => surrender(attemptIds, reportOf(attemptIds, answer.entity, true))}
          />
        )}
      </div>
      <SkinAttemptsMeter skin={skin} engine="reveal-list" failed={failed} won={won} total={maxAttempts} />

      {failedNames.length > 0 && (
        <section className={styles.failed} aria-labelledby={failedTitleId}>
          <h2 className={styles.failedTitle} id={failedTitleId}>
            {es.revealList.failedTitle}
          </h2>
          <ul className={styles.chips}>
            {failedNames.map((attempt) => (
              <li key={attempt.id} className={styles.chip}>
                {/* La cruz acompaña al color, si el tema la quiere: el título de la lista ya dice que son fallos. */}
                {skin.cellMarks === 'all' && <span aria-hidden="true">✕ </span>}
                {attempt.label}
              </li>
            ))}
          </ul>
        </section>
      )}
      {failedNames.length === 0 && !over && <p className={styles.empty}>{es.revealList.empty}</p>}

      <VisuallyHidden role="status">{lastName ? es.revealList.wrongAttempt(lastName, lastAttempt?.revealed ?? false) : ''}</VisuallyHidden>
    </div>
  );
}

'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Autocomplete, type AutocompleteItem } from '@/components/Autocomplete';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { pickDaily, type DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import styles from './ImageRevealBoard.module.scss';
import {
  REVEALED,
  REVEAL_STEPS,
  failedCount,
  pickImage,
  randomFocus,
  restoreAttempts,
  revealStep,
  revealVisual,
  shareGrid,
  type Candidate,
} from './logic';
import { readPrefs, writePrefs, type RevealPrefs } from './prefs';
import { RevealImage } from './RevealImage';
import type { ImageRevealConfig } from './types';

interface ImageRevealBoardProps {
  /** Lo que da el marco (`GameShell`): día, filtros y el aviso de que terminó el reto. */
  session: GameSession;
  config: ImageRevealConfig;
  /** Las respuestas posibles con las series activas. */
  candidates: readonly Candidate[];
  /** Todo lo que se puede intentar con las series activas. */
  options: readonly Entity[];
}

/** El aviso al marco de que terminó el reto: la respuesta, los intentos y la grilla para compartir. */
function reportOf(attemptIds: readonly string[], answer: Candidate, fresh: boolean): FinishReport {
  return {
    won: true,
    attempts: attemptIds.length,
    answer: { label: answer.entity.name.es, imageStem: answer.entity.image },
    grid: shareGrid(attemptIds, answer.id),
    fresh,
  };
}

/**
 * Una partida: el reto de un día para una combinación de filtros. El marco la
 * vuelve a montar cuando cambia cualquiera de los dos, y así recupera desde
 * `localStorage` los intentos de esa combinación.
 */
export function ImageRevealBoard({ session, config, candidates, options }: ImageRevealBoardProps) {
  const { franchise, mode, filterKey, day, onFinish } = session;
  const failedTitleId = useId();
  const difficultyId = useId();
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const answer = useMemo(() => pickDaily(candidates, ctx), [candidates, ctx]);
  const image = useMemo(() => pickImage(answer, ctx), [answer, ctx]);
  // El punto del zoom: el del dato si lo trae y, si no, el del PRNG del día.
  const focus = useMemo(() => image.focus ?? randomFocus(ctx), [image, ctx]);
  const byId = useMemo(() => new Map(options.map((entity) => [entity.id, entity])), [options]);

  const [attemptIds, setAttemptIds] = useState<string[]>(() =>
    restoreAttempts(readState(getLocalStorage(), ctx)?.attempts, options),
  );
  const [lastAttempt, setLastAttempt] = useState<{ id: string; revealed: boolean } | null>(null);
  const [prefs, setPrefs] = useState<RevealPrefs>(() => readPrefs(getLocalStorage(), franchise, mode));

  // Si la partida ya estaba ganada al montarse (se recargó la página), el marco tiene que
  // mostrar su resumen, pero sin volver a sumarla a las estadísticas.
  const [restored] = useState<FinishReport | null>(() =>
    attemptIds.includes(answer.id) ? reportOf(attemptIds, answer, false) : null,
  );
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  const attempted = useMemo(() => new Set(attemptIds), [attemptIds]);
  const won = attempted.has(answer.id);
  const failed = failedCount(attemptIds, answer.id);
  const step = revealStep(failed, prefs.reveal);
  // Al acertar, la imagen se muestra entera, a color y nítida.
  const visual = won ? REVEALED : revealVisual(config.variant, step, prefs.colors, focus);

  const items = useMemo<AutocompleteItem[]>(
    () => options.map((entity) => ({ id: entity.id, label: entity.name.es, aliases: entity.aliases, imageStem: entity.image })),
    [options],
  );

  // Del más reciente al más antiguo: lo último que se probó queda arriba.
  const failedNames = useMemo(
    () =>
      attemptIds
        .filter((id) => id !== answer.id)
        .flatMap((id) => {
          const entity = byId.get(id);
          return entity ? [{ id, label: entity.name.es }] : [];
        })
        .reverse(),
    [attemptIds, answer.id, byId],
  );

  function addAttempt(id: string) {
    if (won || attempted.has(id) || !byId.has(id)) return;
    const next = [...attemptIds, id];
    const solved = id === answer.id;

    setAttemptIds(next);
    setLastAttempt({ id, revealed: prefs.reveal });
    writeState(getLocalStorage(), ctx, { attempts: next, result: solved ? 'won' : 'playing' });

    if (solved) onFinish(reportOf(next, answer, true));
  }

  function updatePrefs(next: RevealPrefs) {
    setPrefs(next);
    writePrefs(getLocalStorage(), franchise, mode, next);
  }

  const lastName = lastAttempt && lastAttempt.id !== answer.id ? byId.get(lastAttempt.id)?.name.es : undefined;

  return (
    <div className={styles.root} data-game-ready="true" data-step={step} data-won={won}>
      {/* Al ganar, el marco muestra la respuesta y el resumen (ver `FinishReport`). */}
      {!won && <Autocomplete label={es.imageReveal.inputLabel} items={items} excludeIds={attempted} onSelect={addAttempt} />}

      <RevealImage
        stem={image.stem}
        width={image.width}
        height={image.height}
        alt={won ? es.imageReveal.imageSolvedAlt(answer.entity.name.es) : es.imageReveal.imageAlt}
        visual={visual}
      />

      {!won && prefs.reveal && (
        <div className={styles.progress}>
          <p className={styles.step}>{es.imageReveal.step(step + 1, REVEAL_STEPS)}</p>
          <div className={styles.segments} aria-hidden="true">
            {Array.from({ length: REVEAL_STEPS }, (_, index) => (
              <span key={index} className={styles.segment} data-on={index <= step} />
            ))}
          </div>
        </div>
      )}

      <p className={styles.counter}>{es.imageReveal.attempts(attemptIds.length)}</p>

      {failedNames.length > 0 && (
        <section className={styles.failed} aria-labelledby={failedTitleId}>
          <h2 className={styles.failedTitle} id={failedTitleId}>
            {es.imageReveal.failedTitle}
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
      {failedNames.length === 0 && !won && <p className={styles.empty}>{es.imageReveal.empty}</p>}

      {!won && (
        <fieldset className={styles.difficulty} aria-labelledby={difficultyId}>
          <legend className={styles.difficultyTitle} id={difficultyId}>
            {es.imageReveal.difficultyTitle}
          </legend>
          <label className={styles.switch}>
            <input
              type="checkbox"
              role="switch"
              className={styles.switchInput}
              checked={prefs.reveal}
              onChange={(event) => updatePrefs({ ...prefs, reveal: event.target.checked })}
            />
            <span className={styles.switchText}>
              <span className={styles.switchLabel}>{es.imageReveal.revealSwitch}</span>
              <span className={styles.switchHint}>{es.imageReveal.revealHint}</span>
            </span>
          </label>
          <label className={styles.switch}>
            <input
              type="checkbox"
              role="switch"
              className={styles.switchInput}
              checked={prefs.colors}
              onChange={(event) => updatePrefs({ ...prefs, colors: event.target.checked })}
            />
            <span className={styles.switchText}>
              <span className={styles.switchLabel}>{es.imageReveal.colorsSwitch}</span>
              <span className={styles.switchHint}>{es.imageReveal.colorsHint}</span>
            </span>
          </label>
        </fieldset>
      )}

      <VisuallyHidden role="status">{lastName ? es.imageReveal.wrongAttempt(lastName, lastAttempt?.revealed ?? false) : ''}</VisuallyHidden>
    </div>
  );
}

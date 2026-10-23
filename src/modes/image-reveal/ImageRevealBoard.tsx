'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { autocompleteItemOf, type AutocompleteItem } from '@/components/Autocomplete';
import { GuessField } from '@/components/GuessField';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { useSkin } from '@/components/skin/context';
import { Chip } from '@/components/ui/Chip';
import { InfoTip } from '@/components/ui/InfoTip';
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
  edgeFocus,
  isCorrect,
  isLost,
  MAX_FAILED,
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

/**
 * El aviso al marco de que terminó el reto, ganado o perdido (se gastaron los intentos): la respuesta, los intentos y la
 * grilla para compartir.
 */
function reportOf(attemptIds: readonly string[], answer: Candidate, accepted: readonly string[], won: boolean, fresh: boolean): FinishReport {
  return {
    won,
    attempts: attemptIds.length,
    answer: { label: answer.entity.name.es, imageStem: answer.entity.image },
    grid: shareGrid(attemptIds, answer.id, accepted),
    fresh,
  };
}

/**
 * Una partida: el reto de un día para una combinación de filtros. El marco la
 * vuelve a montar cuando cambia cualquiera de los dos, y así recupera desde
 * `localStorage` los intentos de esa combinación. Se pierde al fallar tantas veces como pasos de revelado
 * (`MAX_FAILED`): el último fallo cae en el último paso, cuando ya no hay más pistas.
 */
export function ImageRevealBoard({ session, config, candidates, options }: ImageRevealBoardProps) {
  const { franchise, mode, filterKey, day, onFinish } = session;
  const failedTitleId = useId();
  const difficultyId = useId();
  const revealHintId = useId();
  const colorsHintId = useId();
  const { skin } = useSkin();
  const { ChipMark } = skin.slots;
  // Una silueta no tiene colores que mostrar: el interruptor no aplica.
  const hasColors = config.variant !== 'zoom-silhouette';
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const answer = useMemo(() => pickDaily(candidates, ctx), [candidates, ctx]);
  const image = useMemo(() => pickImage(answer, ctx), [answer, ctx]);
  // Una imagen puede ser igual de cierta para más de una entidad (una técnica que usan varios personajes).
  const accepted = useMemo(() => image.accepts ?? [], [image]);
  // El punto del zoom: el del dato si lo trae y, si no, el del PRNG del día. El zoom de la silueta parte siempre de un
  // costado (en el medio de una sombra no se ve nada) y se va corriendo hacia el centro.
  const focus = useMemo(
    () => (config.variant === 'zoom-silhouette' ? edgeFocus(ctx) : (image.focus ?? randomFocus(ctx))),
    [config.variant, image, ctx],
  );
  const byId = useMemo(() => new Map(options.map((entity) => [entity.id, entity])), [options]);

  const [attemptIds, setAttemptIds] = useState<string[]>(() =>
    restoreAttempts(readState(getLocalStorage(), ctx)?.attempts, options),
  );
  const [lastAttempt, setLastAttempt] = useState<{ id: string; revealed: boolean } | null>(null);
  const [prefs, setPrefs] = useState<RevealPrefs>(() => readPrefs(getLocalStorage(), franchise, mode));

  // Si la partida ya había terminado al montarse (se recargó la página), el marco tiene que
  // mostrar su resumen, pero sin volver a sumarla a las estadísticas.
  const [restored] = useState<FinishReport | null>(() => {
    if (attemptIds.some((id) => isCorrect(id, answer.id, accepted))) return reportOf(attemptIds, answer, accepted, true, false);
    return isLost(failedCount(attemptIds, answer.id, accepted)) ? reportOf(attemptIds, answer, accepted, false, false) : null;
  });
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  const attempted = useMemo(() => new Set(attemptIds), [attemptIds]);
  const won = attemptIds.some((id) => isCorrect(id, answer.id, accepted));
  const failed = failedCount(attemptIds, answer.id, accepted);
  const lost = !won && isLost(failed);
  // Ganado o perdido: ya no se puede seguir y se muestra la imagen entera.
  const over = won || lost;
  const step = revealStep(failed, prefs.reveal);
  // Al terminar, la imagen se muestra entera, a color y nítida.
  const visual = over ? REVEALED : revealVisual(config.variant, step, prefs.colors, focus);

  const items = useMemo<AutocompleteItem[]>(
    () => options.map(autocompleteItemOf),
    [options],
  );

  // Del más reciente al más antiguo: lo último que se probó queda arriba.
  const failedNames = useMemo(
    () =>
      attemptIds
        .filter((id) => !isCorrect(id, answer.id, accepted))
        .flatMap((id) => {
          const entity = byId.get(id);
          return entity ? [{ id, label: entity.name.es }] : [];
        })
        .reverse(),
    [attemptIds, answer.id, accepted, byId],
  );

  function addAttempt(id: string) {
    if (over || attempted.has(id) || !byId.has(id)) return;
    const next = [...attemptIds, id];
    const solved = isCorrect(id, answer.id, accepted);
    // Con este fallo se gastaron los intentos: se perdió.
    const spent = !solved && isLost(failedCount(next, answer.id, accepted));

    setAttemptIds(next);
    setLastAttempt({ id, revealed: prefs.reveal });
    writeState(getLocalStorage(), ctx, { attempts: next, result: solved ? 'won' : spent ? 'lost' : 'playing' });

    if (solved || spent) onFinish(reportOf(next, answer, accepted, solved, true));
  }

  function updatePrefs(next: RevealPrefs) {
    setPrefs(next);
    writePrefs(getLocalStorage(), franchise, mode, next);
  }

  const lastName = lastAttempt && !isCorrect(lastAttempt.id, answer.id, accepted) ? byId.get(lastAttempt.id)?.name.es : undefined;

  return (
    <div className={styles.root} data-game-ready="true" data-step={step} data-won={won}>
      {/* Al terminar, ganado o perdido, el marco muestra la respuesta y el resumen (ver `FinishReport`). */}
      {!over && (
        <div className={styles.field}>
          <GuessField label={es.imageReveal.inputLabel} items={items} excludeIds={attempted} onSelect={addAttempt} />
        </div>
      )}

      <RevealImage
        stem={image.stem}
        width={image.width}
        height={image.height}
        alt={over ? es.imageReveal.imageSolvedAlt(answer.entity.name.es) : es.imageReveal.imageAlt}
        visual={visual}
        kind={config.imageContentKind}
      />

      {!over && prefs.reveal && (
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
      {/* Antes del último intento se avisa: si falla, se pierde. */}
      {!over && failed === MAX_FAILED - 1 && (
        <p className={styles.lastChance} role="status">
          {es.imageReveal.lastChance}
        </p>
      )}

      {failedNames.length > 0 && (
        <section className={styles.failed} aria-labelledby={failedTitleId}>
          <h2 className={styles.failedTitle} id={failedTitleId}>
            {es.imageReveal.failedTitle}
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
      {failedNames.length === 0 && !over && <p className={styles.empty}>{es.imageReveal.empty}</p>}

      {!over && (
        <fieldset className={styles.difficulty} aria-labelledby={difficultyId}>
          <legend className={styles.difficultyTitle} id={difficultyId}>
            {es.imageReveal.difficultyTitle}
            <InfoTip compact text={es.help.difficulty} label={es.help.button(es.imageReveal.difficultyTitle)} className={styles.titleHelp} />
          </legend>
          {/* Cada opción es un chip que se prende y se apaga, con su explicación debajo. */}
          <div className={styles.option}>
            <Chip
              pressed={prefs.reveal}
              aria-describedby={revealHintId}
              mark={<ChipMark on={prefs.reveal} />}
              onClick={() => updatePrefs({ ...prefs, reveal: !prefs.reveal })}
            >
              {es.imageReveal.revealSwitch}
            </Chip>
            <p className={styles.optionHint} id={revealHintId}>
              {es.imageReveal.revealHint}
            </p>
          </div>
          {hasColors && (
            <div className={styles.option}>
              <Chip
                pressed={prefs.colors}
                aria-describedby={colorsHintId}
                mark={<ChipMark on={prefs.colors} />}
                onClick={() => updatePrefs({ ...prefs, colors: !prefs.colors })}
              >
                {es.imageReveal.colorsSwitch}
              </Chip>
              <p className={styles.optionHint} id={colorsHintId}>
                {es.imageReveal.colorsHint}
              </p>
            </div>
          )}
        </fieldset>
      )}

      <VisuallyHidden role="status">
        {lastName ? `${es.imageReveal.wrongAttempt(lastName, lastAttempt?.revealed ?? false)}${lost ? ` ${es.imageReveal.lostAnnouncement}` : ''}` : ''}
      </VisuallyHidden>
    </div>
  );
}

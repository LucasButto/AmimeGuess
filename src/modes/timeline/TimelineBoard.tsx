'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { SurrenderButton } from '@/components/game-shell/SurrenderButton';
import { useSurrender } from '@/components/game-shell/useSurrender';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { useSkin } from '@/components/skin/context';
import { InfoTip } from '@/components/ui/InfoTip';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import type { DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import { es } from '@/i18n/es';
import {
  attemptsOf,
  dropRank,
  moveToRank,
  outcomeOf,
  restoreAttempts,
  restoreDraft,
  shareGrid,
  step,
  type Puzzle,
} from './logic';
import styles from './TimelineBoard.module.scss';
import type { TimelineConfig } from './types';

interface TimelineBoardProps {
  /** Lo que da el marco (`GameShell`): día, filtros y el aviso de que terminó el reto. */
  session: GameSession;
  config: TimelineConfig;
  /** Los sucesos del día y cómo empiezan de desordenados. */
  puzzle: Puzzle;
}

/** El aviso al marco de que terminó el reto: de qué suceso a cuál iba el orden, los intentos y la grilla para compartir. */
function reportOf(attempts: readonly (readonly string[])[], puzzle: Puzzle, solved: boolean, fresh: boolean): FinishReport {
  const first = puzzle.solution[0];
  const last = puzzle.solution[puzzle.solution.length - 1];
  return {
    won: solved,
    attempts: attempts.length,
    answer: { label: es.timeline.answerLabel(first.text, last.text) },
    grid: shareGrid(attempts, puzzle),
    fresh,
  };
}

function sameSequence(a: readonly string[] | undefined, b: readonly string[]): boolean {
  return a !== undefined && a.length === b.length && a.every((id, index) => id === b[index]);
}

/** Lo que hace falta saber durante un arrastre. Vive en una referencia: cambia con cada movimiento del puntero. */
interface DragState {
  id: string;
  /** Distancia entre el puntero y el borde de arriba del suceso al agarrarlo. */
  grab: number;
  /** Altura del puntero respecto del borde de arriba de la lista. */
  pointerY: number;
  pointerId: number;
}

type Direction = -1 | 1;

/** Ningún suceso queda fijo: al confirmar no se dice cuáles estaban bien (ver `TimelineBoard`). */
const NO_LOCKS: ReadonlySet<number> = new Set();

/**
 * Una partida: el reto de un día para una combinación de filtros. El marco la vuelve a
 * montar cuando cambia cualquiera de los dos, y así recupera desde `localStorage` los
 * órdenes que se confirmaron. Se ordena arrastrando (eventos de puntero, con el dedo o el
 * mouse) o con los botones de subir y bajar, que también sirven con el teclado. Al
 * confirmar solo se dice si el orden es correcto: no se marca cuáles sucesos están en su lugar ni se fijan, y en cuanto se
 * mueve uno, desaparece el aviso y se puede volver a confirmar. Es a propósito: no se da ninguna ayuda.
 */
export function TimelineBoard({ session, config, puzzle }: TimelineBoardProps) {
  const { franchise, mode, filterKey, day, onFinish } = session;
  const { lost: surrendered, surrender } = useSurrender(session);
  const { skin } = useSkin();
  const { AttemptsMeter } = skin.slots;
  const solutionTitleId = useId();
  const maxAttempts = attemptsOf(config);
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const itemById = useMemo(() => new Map(puzzle.solution.map((item) => [item.id, item])), [puzzle]);

  const [attempts, setAttempts] = useState<string[][]>(() => restoreAttempts(readState(getLocalStorage(), ctx)?.attempts, puzzle, maxAttempts));
  // El orden que se está armando: arranca desde como se dejó la última vez (aunque no se haya confirmado), o desde el
  // último confirmado, o desde el desorden del día. Así cambiar de dificultad y volver no deshace lo acomodado.
  const [arrangement, setArrangement] = useState<string[]>(() => {
    const state = readState(getLocalStorage(), ctx);
    const last = restoreAttempts(state?.attempts, puzzle, maxAttempts).at(-1);
    return restoreDraft(state?.draft, puzzle) ?? last ?? [...puzzle.start];
  });
  const [announcement, setAnnouncement] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const outcome = outcomeOf(attempts, puzzle, maxAttempts);
  const solved = outcome.solved;
  const over = outcome.over || surrendered;
  const locked = NO_LOCKS;
  const lastSubmitted = attempts[attempts.length - 1];

  // Si el reto ya había terminado al montarse (se recargó la página), el marco tiene que mostrar
  // su resumen, pero sin volver a sumarlo a las estadísticas.
  const [restored] = useState<FinishReport | null>(() => (over ? reportOf(attempts, puzzle, solved, false) : null));
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  // --- Referencias a lo que se mide y se enfoca ---------------------------------------
  const listRef = useRef<HTMLOListElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragRef = useRef<DragState | null>(null);
  // Las ventanas de arrastre leen siempre lo último, sin volver a registrarse en cada movimiento.
  const arrangementRef = useRef(arrangement);
  const lockedRef = useRef(locked);
  useEffect(() => {
    arrangementRef.current = arrangement;
    lockedRef.current = locked;
  }, [arrangement, locked]);

  // Guarda el orden que se va armando (sin confirmar) para recuperarlo al volver a esta dificultad. No se guarda al
  // montarse (todavía es lo que ya estaba guardado) ni cuando el reto terminó.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (over) return;
    writeState(getLocalStorage(), ctx, { attempts, result: 'playing', draft: arrangement });
  }, [arrangement, over, attempts, ctx]);
  const focusRequest = useRef<{ id: string; direction: Direction } | null>(null);

  // Registro de los elementos que se miden (sucesos) y se enfocan (botones). Funciones estables: se pasan como `ref`.
  const registerItem = useCallback((id: string, element: HTMLLIElement | null) => {
    if (element) itemRefs.current.set(id, element);
    else itemRefs.current.delete(id);
  }, []);
  const registerButton = useCallback((key: string, element: HTMLButtonElement | null) => {
    if (element) buttonRefs.current.set(key, element);
    else buttonRefs.current.delete(key);
  }, []);

  // El foco acompaña al suceso que se movió con un botón: al reordenarse la lista el navegador lo suelta.
  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    const wanted = buttonRefs.current.get(`${request.id}:${request.direction}`);
    const other = buttonRefs.current.get(`${request.id}:${-request.direction}`);
    (wanted && !wanted.disabled ? wanted : other)?.focus();
  }, [arrangement]);

  // --- Mover con botones ------------------------------------------------------------
  function moveByStep(index: number, direction: Direction) {
    if (over) return;
    const id = arrangement[index];
    const moved = step(arrangement, locked, index, direction);
    if (!moved) return;
    focusRequest.current = { id, direction };
    setArrangement(moved.arrangement);
    setAnnouncement(es.timeline.moved(itemById.get(id)?.text ?? '', moved.index + 1, arrangement.length));
  }

  // --- Arrastrar ---------------------------------------------------------------------
  /** Pone al suceso arrastrado donde está el puntero. Es un valor calculado en cada movimiento, por eso va como variable CSS. */
  const applyDrag = useCallback(() => {
    const drag = dragRef.current;
    const element = drag ? itemRefs.current.get(drag.id) : undefined;
    if (!drag || !element) return;
    element.style.setProperty('--drag-offset', `${drag.pointerY - drag.grab - element.offsetTop}px`);
  }, []);

  function startDrag(event: ReactPointerEvent, id: string) {
    if (over || event.pointerType === 'mouse' && event.button !== 0) return;
    const element = itemRefs.current.get(id);
    const list = listRef.current;
    if (!element || !list || locked.has(arrangementRef.current.indexOf(id))) return;
    event.preventDefault();
    dragRef.current = {
      id,
      grab: event.clientY - element.getBoundingClientRect().top,
      pointerY: event.clientY - list.getBoundingClientRect().top,
      pointerId: event.pointerId,
    };
    // El puntero queda capturado por la lista, que no se mueve: al reordenar, React puede mover en el DOM el asa que
    // el dedo tiene agarrada, y sin esto algunos navegadores táctiles dejarían de mandar eventos.
    try {
      list.setPointerCapture(event.pointerId);
    } catch {
      // El puntero ya no está activo: no hay nada que capturar.
    }
    setDraggingId(id);
  }

  useEffect(() => {
    if (draggingId === null) return;

    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      const list = listRef.current;
      const element = drag ? itemRefs.current.get(drag.id) : undefined;
      if (!drag || !list || !element) return;
      drag.pointerY = event.clientY - list.getBoundingClientRect().top;
      applyDrag();

      // Dónde quedaría entre los que se pueden mover, según el centro del suceso arrastrado.
      const center = drag.pointerY - drag.grab + element.offsetHeight / 2;
      const centers = arrangementRef.current.flatMap((id, index) => {
        const other = itemRefs.current.get(id);
        return id === drag.id || lockedRef.current.has(index) || !other ? [] : [other.offsetTop + other.offsetHeight / 2];
      });
      const moved = moveToRank(arrangementRef.current, lockedRef.current, drag.id, dropRank(centers, center));
      if (moved && !sameSequence(arrangementRef.current, moved)) {
        // Al instante y sin esperar al próximo cuadro: si llega otro movimiento antes de que React dibuje, tiene que
        // medir sobre la lista ya reordenada y no sobre la anterior.
        arrangementRef.current = moved;
        flushSync(() => setArrangement(moved));
        applyDrag();
      }
    }

    function onEnd() {
      const drag = dragRef.current;
      if (drag) {
        try {
          listRef.current?.releasePointerCapture(drag.pointerId);
        } catch {
          // Ya se soltó sola al terminar el gesto.
        }
        itemRefs.current.get(drag.id)?.style.removeProperty('--drag-offset');
        const position = arrangementRef.current.indexOf(drag.id) + 1;
        setAnnouncement(es.timeline.moved(itemById.get(drag.id)?.text ?? '', position, arrangementRef.current.length));
      }
      dragRef.current = null;
      setDraggingId(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [draggingId, itemById, applyDrag]);

  // Al reordenarse la lista durante un arrastre, el suceso cambia de lugar: se vuelve a acomodar bajo el puntero.
  useEffect(() => {
    applyDrag();
  }, [arrangement, applyDrag]);

  // --- Confirmar -----------------------------------------------------------------------
  function confirm() {
    if (over) return;
    const next = [...attempts, arrangement];
    const nextOutcome = outcomeOf(next, puzzle, maxAttempts);

    setAttempts(next);
    writeState(getLocalStorage(), ctx, { attempts: next, result: nextOutcome.solved ? 'won' : nextOutcome.over ? 'lost' : 'playing' });
    setAnnouncement(
      nextOutcome.solved
        ? es.timeline.solvedAnnouncement
        : nextOutcome.over
          ? `${es.timeline.confirmed(next.length)} ${es.timeline.lostAnnouncement}`
          : es.timeline.confirmed(next.length),
    );
    if (nextOutcome.over) onFinish(reportOf(next, puzzle, nextOutcome.solved, true));
  }

  const unchanged = sameSequence(lastSubmitted, arrangement);
  // El veredicto, para el aspecto de la lista entera (no de cada suceso): rojo mientras el orden confirmado esté sin tocar
  // y no sea el correcto; verde al resolverlo. En cuanto se mueve un suceso, vuelve a lo neutro.
  const verdict = solved ? 'right' : attempts.length > 0 && unchanged ? 'wrong' : undefined;
  // El color del último veredicto, que queda aunque el veredicto se vaya: así un tema puede animar también su salida.
  const tint = solved ? 'right' : attempts.length > 0 ? 'wrong' : undefined;

  return (
    <div className={styles.root} data-game-ready="true" data-over={over} data-won={solved}>
      <header className={styles.header}>
        <p className={styles.instructions}>
          {es.timeline.instructions}
          {config.orderHelp && <InfoTip compact text={config.orderHelp} label={es.help.button(es.timeline.orderHelpTopic)} />}
        </p>
      </header>

      <p className={styles.end}>
        <span aria-hidden="true">↑</span> {es.timeline.oldest}
      </p>
      <ol ref={listRef} className={styles.list} aria-label={es.timeline.listLabel} data-part="path" data-verdict={verdict} data-tint={tint}>
        {arrangement.map((id, index) => {
          const item = itemById.get(id);
          if (!item) return null;
          // Solo al resolverlo se ven los sucesos en su lugar (todos); antes, ninguno lleva marca.
          const state = solved ? 'locked' : 'free';
          const movable = !over;
          const canMove = (direction: Direction) => movable && step(arrangement, locked, index, direction) !== null;

          return (
            <li
              key={id}
              ref={(element) => registerItem(id, element)}
              className={styles.item}
              data-item="true"
              data-state={state}
              data-dragging={draggingId === id}
              // Con el mouse o el lápiz también se agarra desde el medio (el texto), no solo desde el asa; los botones de la
              // derecha no. Con el dedo solo vale el asa: arrastrar desde el texto tiene que seguir desplazando la página.
              onPointerDown={(event) => {
                if (!movable || event.pointerType === 'touch') return;
                if (event.target instanceof Element && event.target.closest('button, [data-handle]')) return;
                startDrag(event, id);
              }}
            >
              {movable && <span className={styles.handle} data-handle="true" aria-hidden="true" onPointerDown={(event) => startDrag(event, id)} />}
              <p className={styles.text}>
                <span className={styles.position} aria-hidden="true">
                  {index + 1}
                </span>
                {item.text}
                {state === 'locked' && <VisuallyHidden>{` (${es.timeline.stateLocked})`}</VisuallyHidden>}
              </p>
              {/* La marca acompaña al color: el estado no depende de verlo en verde o en rojo. */}
              {state === 'locked' && skin.cellMarks !== 'arrows' && (
                <span className={styles.mark} aria-hidden="true">
                  ✓
                </span>
              )}
              {movable && (
                <div className={styles.moves}>
                  <button
                    type="button"
                    ref={(element) => registerButton(`${id}:-1`, element)}
                    className={styles.move}
                    aria-label={es.timeline.moveUp(item.text)}
                    disabled={!canMove(-1)}
                    onClick={() => moveByStep(index, -1)}
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    type="button"
                    ref={(element) => registerButton(`${id}:1`, element)}
                    className={styles.move}
                    aria-label={es.timeline.moveDown(item.text)}
                    disabled={!canMove(1)}
                    onClick={() => moveByStep(index, 1)}
                  >
                    <span aria-hidden="true">▼</span>
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className={styles.end}>
        <span aria-hidden="true">↓</span> {es.timeline.newest}
      </p>

      <div className={styles.actions}>
        {/* Los intentos van a la derecha del botón de confirmar, bien a la vista (y siguen cuando el reto terminó). */}
        <div className={styles.confirmRow}>
          {!over && (
            <button type="button" className={styles.confirm} onClick={confirm} disabled={unchanged}>
              {es.timeline.confirm}
            </button>
          )}
          <div className={styles.counter}>
            <div className={styles.counterInfo}>
              {/* El texto queda siempre (lectores de pantalla); un tema con medidor propio puede ocultarlo a la vista. */}
              <p data-part="attempts">{es.timeline.attempt(Math.min(attempts.length + 1, maxAttempts), maxAttempts)}</p>
              <AttemptsMeter failed={attempts.length - (solved ? 1 : 0)} won={solved} total={maxAttempts} />
            </div>
            {!over && (
              <SurrenderButton
                disabled={draggingId !== null}
                onConfirm={() => surrender(attempts, reportOf(attempts, puzzle, false, true), arrangement)}
              />
            )}
          </div>
        </div>
        {/* El orden confirmado estaba mal: se dice, sin más. Al mover cualquier suceso, el aviso se va. */}
        {!over && unchanged && (
          <p className={styles.wrong} data-part="wrong">
            {es.timeline.wrongOrder}
          </p>
        )}
      </div>

      {over && !solved && (
        <section className={styles.solution} aria-labelledby={solutionTitleId}>
          <h2 className={styles.solutionTitle} id={solutionTitleId}>
            {es.timeline.correctOrderTitle}
          </h2>
          <ol className={styles.solutionList}>
            {puzzle.solution.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ol>
        </section>
      )}

      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
    </div>
  );
}


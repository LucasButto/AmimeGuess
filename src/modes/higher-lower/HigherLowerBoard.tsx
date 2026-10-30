'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react';
import { ContentImage } from '@/components/ContentImage';
import { SurrenderButton } from '@/components/game-shell/SurrenderButton';
import { useSurrender } from '@/components/game-shell/useSurrender';
import type { FinishReport, GameSession } from '@/components/game-shell/types';
import { useSkin } from '@/components/skin/context';
import { SkinAttemptsMeter, SkinComparisonMedia } from '@/components/skin/gameSlots';
import { TitleWords } from '@/components/TitleWords';
import { InfoTip } from '@/components/ui/InfoTip';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import type { DailyContext } from '@/engine/daily';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import styles from './HigherLowerBoard.module.scss';
import { MAX_ROUNDS, formatMetric, progressOf, restorePicks, sharePicks, winnerOf, type Progress, type Round } from './logic';
import { readRecord, recordKey, saveRecord } from './record';
import type { HigherLowerMetric } from './types';

interface HigherLowerBoardProps {
  /** Lo que da el marco (`GameShell`): día, filtros y el aviso de que terminó la partida. */
  session: GameSession;
  /** La métrica del día. */
  metric: HigherLowerMetric;
  /** Los pares del día, en orden. */
  rounds: readonly Round[];
  /** Solo en infinito: entrega más pares sin reemplazar los ya jugados. */
  extendRounds?: (length: number) => readonly Round[];
}

/** Un espacio sin ancho después de cada punto: un número de 25 cifras baja de renglón entre grupos de tres. */
const breakable = (text: string): string => text.replaceAll('.', '.​');

/** Lo que dura el fundido de salida al pasar de ronda (el mismo que `option-out` en el `.module.scss`). */
const LEAVE_MS = 200;

/** El aviso al marco de que terminó la partida: el puntaje, la última ronda y la grilla para compartir. */
function reportOf(picks: readonly string[], progress: Progress, rounds: readonly Round[], metric: HigherLowerMetric, fresh: boolean): FinishReport {
  const failed = progress.failedAt !== null;
  const last = rounds[picks.length - 1];
  const winner = last ? winnerOf(last) : undefined;
  const loser = last ? (winner === last.a ? last.b : last.a) : undefined;
  const winnerValue = last && winner === last.a ? last.aValue : last?.bValue;
  const loserValue = last && winner === last.a ? last.bValue : last?.aValue;

  return {
    won: !failed,
    attempts: picks.length,
    score: progress.score,
    answer: {
      label:
        failed && winner && loser && winnerValue !== undefined && loserValue !== undefined
          ? es.higherLower.lastRound(
              winner.name.es,
              breakable(formatMetric(metric, winnerValue)),
              loser.name.es,
              breakable(formatMetric(metric, loserValue)),
            )
          : '',
      imageStem: failed ? winner?.image : undefined,
    },
    grid: sharePicks(picks, rounds),
    fresh,
  };
}

/**
 * Una partida: los pares de un día para una combinación de filtros. El marco la
 * vuelve a montar cuando cambia cualquiera de los dos, y así recupera desde
 * `localStorage` las elecciones de esa combinación. Se juega hasta el primer
 * error; el puntaje son los aciertos seguidos.
 */
export function HigherLowerBoard({ session, metric, rounds: initialRounds, extendRounds }: HigherLowerBoardProps) {
  const { franchise, mode, filterKey, day, onFinish } = session;
  const maxMistakes = session.attemptLimit ?? 1;
  const { lost: surrendered, surrender } = useSurrender(session);
  const questionId = useId();
  const { skin } = useSkin();
  const { MetricMark } = skin.slots;
  const ctx = useMemo<DailyContext>(() => ({ franchise, mode, filterKey, day }), [franchise, mode, filterKey, day]);
  const [rounds, setRounds] = useState(() => extendRounds?.((readState(getLocalStorage(), ctx)?.attempts.length ?? 0) + 1) ?? initialRounds);
  const bestKey = recordKey(franchise, mode, session.active, maxMistakes === 1 ? metric.key : `${metric.key}~try-${maxMistakes}`);
  const [target] = useState(() => session.practice ? readRecord(getLocalStorage(), bestKey) : 0);
  const [record, setRecord] = useState(target);
  // El valor más largo del día, escrito como se ve: reserva su lugar en las dos opciones desde antes de elegir, así
  // mostrar los números no agranda las tarjetas. Es el mismo en todas las rondas, así no dice nada de la ronda.
  const valueSizer = useMemo(
    () =>
      rounds
        .flatMap((round) => [round.aValue, round.bValue])
        .map((value) => breakable(formatMetric(metric, value)).replace(/\d/g, '0'))
        .reduce((longest, text) => (text.length > longest.length ? text : longest), ''),
    [rounds, metric],
  );

  const [picks, setPicks] = useState<string[]>(() => restorePicks(readState(getLocalStorage(), ctx)?.attempts, rounds, maxMistakes));
  // Tras un acierto se muestran los valores de esa ronda hasta que se toca "Siguiente".
  const [awaitingNext, setAwaitingNext] = useState(false);
  // Al tocar "Siguiente", lo de las dos opciones se desvanece antes de que entre la ronda nueva.
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  const progress = progressOf(picks, rounds, maxMistakes, session.practice ? undefined : MAX_ROUNDS);
  const mistakes = picks.filter((id, index) => id !== winnerOf(rounds[index]).id).length;
  const ended = progress.ended || surrendered;
  const revealed = ended || awaitingNext;
  const nextRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  // Si la partida ya había terminado al montarse (se recargó la página), el marco tiene que
  // mostrar su resumen, pero sin volver a sumarla a las estadísticas.
  const [restored] = useState<FinishReport | null>(() => (ended ? { ...reportOf(picks, progress, rounds, metric, false), won: !surrendered && progress.failedAt === null } : null));
  useEffect(() => {
    if (restored) onFinish(restored);
  }, [restored, onFinish]);

  // La ronda que se ve: la de las elecciones hechas, o la última si se están mostrando sus valores.
  const index = (surrendered ? progress.ended : revealed) ? Math.max(0, picks.length - 1) : picks.length;
  const round = rounds[Math.min(index, rounds.length - 1)];
  const winner = winnerOf(round);
  const picked = picks[index];

  // El foco acompaña al juego: al elegir pasa a "Siguiente" y, al seguir, vuelve a las opciones.
  useEffect(() => {
    if (awaitingNext) nextRef.current?.focus();
  }, [awaitingNext]);
  const roundNumber = index + 1;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!revealed) firstOptionRef.current?.focus();
  }, [roundNumber, revealed]);

  function advance() {
    if (ended || leaving) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAwaitingNext(false);
      return;
    }
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => {
      setLeaving(false);
      setAwaitingNext(false);
    }, LEAVE_MS);
  }

  function choose(id: string) {
    if (revealed) return;
    const next = [...picks, id];
    // Siempre queda al menos un par pendiente en infinito: alcanzar el final
    // de una tanda no termina la racha ni emite un resultado.
    const nextRounds = extendRounds?.(next.length + 1) ?? rounds;
    const nextProgress = progressOf(next, nextRounds, maxMistakes, session.practice ? undefined : MAX_ROUNDS);

    setRounds(nextRounds);
    setPicks(next);
    if (session.practice) setRecord(Math.max(record, saveRecord(getLocalStorage(), bestKey, nextProgress.score)));
    writeState(getLocalStorage(), ctx, { attempts: next, result: nextProgress.ended ? nextProgress.failedAt === null ? 'won' : 'lost' : 'playing' });
    if (nextProgress.ended) onFinish(reportOf(next, nextProgress, nextRounds, metric, true));
    else setAwaitingNext(true);
  }

  const status = surrendered ? es.shell.surrender.ended : !revealed
    ? ''
    : picked === winner.id
      ? es.higherLower.announceCorrect(winner.name.es)
      : es.higherLower.announceWrong(winner.name.es);

  return (
    <div className={styles.root} data-game-ready="true" data-ended={ended}>
      <header className={styles.header}>
        <div className={styles.questionRow}>
          <MetricMark metric={metric.key} />
          <h2 className={styles.question} id={questionId}>
            {metric.question}
          </h2>
          <InfoTip compact text={es.help.metric} label={es.help.button(metric.label)} />
        </div>
        <div className={styles.meta}>
          <div className={styles.scoreInfo}>
            <span>{es.higherLower.roundLabel(roundNumber)}</span>
            <span className={styles.score}>{session.practice ? maxMistakes === 1 ? es.higherLower.score(progress.score) : es.higherLower.totalScore(progress.score) : es.higherLower.dailyScore(progress.score, MAX_ROUNDS)}</span>
            {maxMistakes > 1 && <span>{es.shell.limits.mistakes(mistakes, maxMistakes)}</span>}
            {session.practice && <span>{es.higherLower.record(record)}</span>}
            {session.practice && <span className={styles.score}>{progress.score > target ? es.higherLower.newRecord : es.higherLower.target(target + 1)}</span>}
          </div>
          {!ended && (
            <SurrenderButton
              scored
              onConfirm={() => {
                window.clearTimeout(leaveTimer.current);
                setLeaving(false);
                setAwaitingNext(false);
                surrender(picks, reportOf(picks, progress, rounds, metric, true));
              }}
            />
          )}
        </div>
      </header>
      {/* Se juega hasta el primer fallo: un solo intento fallido agota el medidor. */}
      <SkinAttemptsMeter skin={skin} engine="higher-lower" failed={mistakes} won={ended && !surrendered && progress.failedAt === null} total={maxMistakes} />

      <div className={styles.options} role="group" aria-labelledby={questionId} data-part="duel" data-leaving={leaving}>
        {([round.a, round.b] as const).map((entity, position) => (
          <Option
            key={`${index}-${entity.id}`}
            entity={entity}
            value={position === 0 ? round.aValue : round.bValue}
            max={Math.max(round.aValue, round.bValue)}
            metric={metric}
            sizer={valueSizer}
            revealed={revealed}
            isWinner={entity.id === winner.id}
            isPicked={entity.id === picked}
            onChoose={choose}
            buttonRef={position === 0 ? firstOptionRef : undefined}
          />
        ))}
        {/* En el medio del duelo, donde se cruzan los dos: pasa a la ronda siguiente. */}
        {awaitingNext && !ended && (
          <button type="button" className={styles.next} data-part="next" ref={nextRef} onClick={advance}>
            <TitleWords text={es.higherLower.next} />
          </button>
        )}
      </div>

      {/* Antes de elegir ya ocupa su lugar (invisible, con el texto de un acierto): mostrar el resultado no mueve la página. */}
      <div className={styles.outcome} data-correct={picked === winner.id} data-pending={!revealed}>
        <p className={styles.outcomeText}>
          {surrendered ? es.shell.surrender.ended : !revealed
            ? es.higherLower.correct
            : ended && progress.failedAt === null
              ? es.higherLower.perfect
              : picked === winner.id
                ? es.higherLower.correct
                : es.higherLower.wrong(winner.name.es)}
        </p>
      </div>

      <VisuallyHidden role="status">{status}</VisuallyHidden>
    </div>
  );
}

interface OptionProps {
  entity: Entity;
  value: number;
  /** El mayor de los dos valores: la barra de cada opción es proporcional a él. */
  max: number;
  metric: HigherLowerMetric;
  /** El valor más largo del día (con cifras en 0): reserva el lugar del valor desde antes de elegir. */
  sizer: string;
  revealed: boolean;
  isWinner: boolean;
  isPicked: boolean;
  onChoose: (id: string) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

/** Nivel de una barra según cuánto la llena su valor: el tema puede pintar cada nivel distinto. */
function meterLevel(share: number): 'high' | 'mid' | 'low' {
  return share >= 0.5 ? 'high' : share >= 0.2 ? 'mid' : 'low';
}

/** Una de las dos opciones: se toca para elegirla y, ya elegida, muestra su valor y si era la mayor. */
function Option({ entity, value, max, metric, sizer, revealed, isWinner, isPicked, onChoose, buttonRef }: OptionProps) {
  const { skin } = useSkin();
  const marks = skin.cellMarks;
  const share = max > 0 ? Math.max(0, value) / max : 0;
  return (
    <button
      type="button"
      ref={buttonRef}
      className={styles.option}
      data-option="true"
      data-revealed={revealed}
      data-winner={revealed && isWinner}
      data-picked={revealed && isPicked}
      disabled={revealed}
      onClick={() => onChoose(entity.id)}
    >
      <SkinComparisonMedia skin={skin} entity={entity} metric={metric.key} revealed={revealed}>
        {entity.image && (
          <ContentImage className={styles.image} stem={entity.image} alt="" sizes="(min-width: 48rem) 10rem, 5rem" priority />
        )}
      </SkinComparisonMedia>
      <span className={styles.details} data-part="reading">
        <span className={styles.name} aria-hidden={skin.customComparisonMedia || undefined}>{entity.name.es}</span>
        <span className={styles.value} data-part="value" aria-hidden={skin.customComparisonMedia || undefined}>
          <span className={styles.valueSizer} aria-hidden="true">
            {sizer}
          </span>
          {revealed && <span>{breakable(formatMetric(metric, value))}</span>}
        </span>
        {revealed && (
          // Barra proporcional al valor (el mayor llena la barra). Decorativa: el valor ya está escrito.
          <span className={styles.meter} aria-hidden="true" data-part="meter" data-level={meterLevel(share)}>
            <span className={styles.meterFill} style={{ '--share': share } as CSSProperties} />
          </span>
        )}
        {revealed && (
          <span className={styles.badges} data-part="badges">
            {/* El resultado va en texto con su ícono: no depende del color. */}
            {isWinner && (
              <span className={styles.badge} data-kind="winner">
                {marks !== 'arrows' && '✓ '}
                {es.higherLower.higher}
              </span>
            )}
            {isPicked && <span className={styles.badge} data-kind="picked">{es.higherLower.picked}</span>}
          </span>
        )}
      </span>
      {/* El tachado del que no era: decorativo (el resultado ya está escrito); por defecto no se ve, lo dibuja la piel. */}
      {revealed && !isWinner && <span className={styles.strike} data-part="strike" aria-hidden="true" />}
    </button>
  );
}

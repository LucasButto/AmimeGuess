'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AttemptRules } from '@/components/game-shell/AttemptRules';
import { GameShell } from '@/components/game-shell/GameShell';
import { useVersusVariant } from '@/components/versus/VersusGameContext';
import { AttemptsStatus } from '@/components/game-shell/AttemptsStatus';
import { DockAction, useDockTarget } from '@/components/game-shell/GameDock';
import { SurrenderButton } from '@/components/game-shell/SurrenderButton';
import { useSurrender } from '@/components/game-shell/useSurrender';
import { endLimit, isUnlimited, useVersusProgress, useVersusStop } from '@/components/game-shell/versus';
import type { FinishReport, GameSession, GameShellProps } from '@/components/game-shell/types';
import { ContentImage } from '@/components/ContentImage';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { InfoTip } from '@/components/ui/InfoTip';
import { useSkin } from '@/components/skin/context';
import { SkinAttemptsMeter } from '@/components/skin/gameSlots';
import { useSound } from '@/components/skin/useSound';
import { useHaptics } from '@/components/useHaptics';
import { getLocalStorage, readState, STORAGE_PREFIX, writeState } from '@/engine/storage';
import type { Entity } from '@/engine/types';
import { seedFor } from '@/engine/daily';
import { mulberry32, shuffle } from '@/engine/rng';
import { es } from '@/i18n/es';
import { ATTEMPT_LIMITS, availableCategories, BOARD_SIZE, buildRound, categoriesOf, chooseCategory, confirmPlacement, emptyDraft, poolOf, restoreGame, roundIndex } from './logic';
import type { BoardCategory, BoardState, CategoryBoardConfig, RoundResult } from './types';
import styles from './CategoryBoardGame.module.scss';

const copy = es.categoryBoard;
const wildcard: BoardCategory = { ...copy.wildcard, members: [], wildcard: true };
type Props = Pick<GameShellProps, 'franchise' | 'mode' | 'modes'> & { config: CategoryBoardConfig; entities: readonly Entity[] };

function readLevel(franchise: string): number {
  try {
    const value = getLocalStorage()?.getItem(`${STORAGE_PREFIX}:level:${franchise}:casillas`);
    return value !== null && value !== undefined && ['0', '1', '2'].includes(value) ? Number(value) : 1;
  } catch { return 1; }
}

export function CategoryBoardGame({ franchise, mode, modes, config, entities }: Props) {
  // En versus, la dificultad es la de la partida (`d1` a `d3`; sin variante, la normal) y no se guarda.
  const versus = useVersusVariant();
  const [level, setLevel] = useState(() => {
    if (!versus) return readLevel(franchise.slug);
    const index = Number(versus.variant?.match(/^d([123])$/)?.[1] ?? 2) - 1;
    return index;
  });
  const rules = useContext(AttemptRules);
  const base = rules?.base ?? ATTEMPT_LIMITS[1];
  const limits = [base + 1, base, Math.max(1, base - 1)];
  const poolSize = useCallback((active: readonly string[]) => {
    const pool = poolOf(entities, active, config);
    return categoriesOf(pool, config, wildcard, active).length === BOARD_SIZE ? pool.length : 0;
  }, [entities, config]);
  return <GameShell franchise={franchise} mode={mode} modes={modes} minimumPool={10} poolSize={poolSize} yesterday={() => null}
    variant={`d${level + 1}`} help={<>{copy.help.map((text, index) => <p key={text}>{index === 1 && config.reassignCurrent ? copy.reassignHelp : text}</p>)}</>}
    beforeGame={() => <div className={styles.settings} role="group" aria-label={copy.difficulty}>
      <strong>{copy.difficulty}</strong>
      <div className={styles.levels}>{limits.map((limit, index) => <Chip key={index} pressed={level === index} onClick={() => {
        setLevel(index);
        try { getLocalStorage()?.setItem(`${STORAGE_PREFIX}:level:${franchise.slug}:casillas`, String(index)); } catch { /* Preferencia opcional. */ }
      }}>{copy.levels[index]}<span className={styles.levelDetail}>{copy.levelAttempts(limit)}</span></Chip>)}</div>
    </div>}>
    {(session) => <CategoryBoardSession session={session} pool={poolOf(entities, session.active, config)} config={config} limit={limits[level]} level={level} />}
  </GameShell>;
}

function CategoryBoardSession({ session, pool, config, limit, level }: { session: GameSession; pool: readonly Entity[]; config: CategoryBoardConfig; limit: number; level: number }) {
  const categories = useMemo(() => categoriesOf(pool, config, wildcard, session.active), [pool, config, session.active]);
  if (categories.length !== BOARD_SIZE) return <p role="status">{copy.noBoard}</p>;
  return <CategoryBoard session={session} pool={pool} categories={categories} limit={limit} level={level} questionImage={config.questionImage} reassignCurrent={config.reassignCurrent} />;
}

export function CategoryBoard({ session, pool, categories, limit: levelLimit, level, questionImage = 'common/roulette-question', reassignCurrent = false }: { session: GameSession; pool: readonly Entity[]; categories: readonly BoardCategory[]; limit: number; level: number; questionImage?: string; reassignCurrent?: boolean }) {
  // En versus sin límite, los tableros fallidos no terminan la partida.
  const limit = endLimit(session, levelLimit);
  const unlimited = isUnlimited(session);
  const drawsFor = useCallback((index: number) => buildRound(pool, categories, session, index), [pool, categories, session]);
  const [state, setState] = useState(() => restoreGame(readState(getLocalStorage(), session), drawsFor, categories, limit, reassignCurrent));
  const stateRef = useRef(state);
  const { lost, surrender } = useSurrender(session);
  const { skin } = useSkin();
  const play = useSound();
  const buzz = useHaptics();
  const phone = useDockTarget() !== null;
  const index = roundIndex(state);
  const draws = useMemo(() => drawsFor(index), [drawsFor, index]);
  const { placements, phase } = state.draft;
  const won = phase === 'won';
  const failed = phase === 'failed';
  const over = won || lost || (failed && state.rounds.length >= limit);
  const current = draws[Math.min(placements.length, draws.length - 1)];
  const previous = draws[Math.max(0, placements.length - 1)];
  const moving = reassignCurrent && phase === 'placed';
  const canPlace = phase === 'choosing' || moving;
  const placing = moving ? previous : current;
  const [preview, setPreview] = useState(0);
  const [decoded, setDecoded] = useState<readonly Entity[]>([]);
  const reel = useMemo(() => shuffle(mulberry32(seedFor({ ...session, mode: `${session.mode}:preview:${index}` })), pool.filter((entity) => entity.image)).slice(0, 12), [pool, session, index]);
  useEffect(() => {
    if (phone) return;
    let active = true;
    const images: Entity[] = [];
    for (const entity of reel) {
      const img = new window.Image();
      img.src = `/img/${entity.image}-256.webp`;
      img.decode().then(() => { if (active) { images.push(entity); setDecoded([...images]); } }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [reel, phone]);
  useEffect(() => {
    if (phone || phase !== 'rolling' || over || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setPreview((value) => value + 1), 110);
    return () => window.clearInterval(timer);
  }, [phase, over, phone]);

  const reportOf = useCallback((next: BoardState, success: boolean, fresh: boolean): FinishReport => ({
    won: success, fresh, attempts: Math.max(1, next.rounds.length), answerIsSentence: true,
    sheetDelayMs: !success && fresh ? 300 : undefined,
    title: success ? copy.won : es.shell.result.lostTitle,
    answer: { label: copy.result(next.draft.placements.filter((id) => id !== wildcard.id).length) },
    grid: next.rounds.map((round) => `${'🟩'.repeat(round.placements.length)}${round.outcome === 'won' ? '' : '🟥'}`),
  }), []);
  const [restored] = useState(() => over ? reportOf(state, won, false) : null);
  // Versus: lo que ven los rivales (tableros usados y casillas llenas) y el cierre desde afuera (tiempo agotado).
  useVersusProgress(session, { attempts: state.rounds.length, score: placements.filter((id) => id !== wildcard.id).length });
  useVersusStop(session, over, (stop) => {
    if (stop === 'timeUp') surrender(state.rounds, { ...reportOf(state, false, true), timedOut: true }, state.draft);
  });
  const onFinish = session.onFinish;
  useEffect(() => { if (restored) onFinish(restored); }, [restored, onFinish]);

  function commit(next: BoardState, finished = false) {
    stateRef.current = next;
    setState(next);
    const success = next.draft.phase === 'won';
    writeState(getLocalStorage(), session, { attempts: [...next.rounds], draft: next.draft, result: finished ? success ? 'won' : 'lost' : 'playing' });
    if (finished) onFinish(reportOf(next, success, true));
  }
  function fail(outcome: 'wrong' | 'blocked', rejectedCategory?: string) {
    const before = stateRef.current;
    const round: RoundResult = { placements: before.draft.placements, outcome, ...(rejectedCategory ? { rejectedCategory } : {}) };
    const next: BoardState = { rounds: [...before.rounds, round], draft: { ...before.draft, phase: 'failed', rejectedCategory } };
    play('miss'); buzz('miss');
    commit(next, next.rounds.length >= limit);
  }
  function action() {
    const before = stateRef.current;
    if (over) return;
    if (before.draft.phase === 'failed') commit({ rounds: before.rounds, draft: emptyDraft() });
    else if (before.draft.phase === 'placed' && reassignCurrent) {
      const next = confirmPlacement(before, categories, phone ? 'choosing' : 'rolling');
      if (next.draft.phase === 'won') commit(next, true);
      else if (phone && availableCategories(categories, before.draft.placements, current.id).length === 0) fail('blocked');
      else commit(next);
    }
    else if (before.draft.phase === 'placed' && !phone) commit({ ...before, draft: { ...before.draft, phase: 'rolling' } });
    else if (before.draft.phase === 'rolling' || before.draft.phase === 'placed' && phone) {
      if (availableCategories(categories, before.draft.placements, current.id).length === 0) fail('blocked');
      else commit({ ...before, draft: { ...before.draft, phase: 'choosing' } });
    }
  }
  function place(category: BoardCategory) {
    const before = stateRef.current;
    if (over) return;
    const entity = draws[before.draft.placements.length - (before.draft.phase === 'placed' ? 1 : 0)];
    if (!entity) return;
    const next = chooseCategory(before, category, entity.id, categories, reassignCurrent);
    if (next === before) return;
    if (next.draft.rejectedCategory) { play('miss'); buzz('miss'); commit(next); return; }
    play('reveal'); buzz('hit');
    commit(next, next.draft.phase === 'won');
  }

  const shown = phase === 'rolling' && !over ? decoded[preview % Math.max(1, decoded.length)] : phase === 'placed' || won ? previous : current;
  const actionLabel = over ? copy.finished : failed ? copy.retry : phase === 'rolling' ? phone ? copy.reveal : copy.stop : phase === 'placed' ? copy.next : copy.choose;
  const rejected = categories.find((category) => category.id === state.draft.rejectedCategory);
  const filled = placements.filter((id) => id !== wildcard.id).length;
  const placedLabel = phase === 'placed' ? categories.find((category) => category.id === placements.at(-1))!.label : '';
  const message = won ? copy.won : failed ? copy.blocked(current.name.es)
    : canPlace && rejected ? copy.wrong(placing.name.es, rejected.label, !placements.includes(wildcard.id))
    : moving ? copy.pending(previous.name.es, placedLabel)
    : phase === 'placed' ? copy.placed(previous.name.es, placedLabel)
    : phase === 'choosing' ? copy.choose : copy.rolling;
  const portraitContent = <>
    <div className={styles.portrait} data-rolling={phase === 'rolling' && !over}>
      {phone && phase === 'rolling' && !over ? <ContentImage className={styles.portraitImage} stem={questionImage} alt="" sizes="9rem" priority /> : shown?.image ? <ContentImage className={styles.portraitImage} stem={shown.image} alt="" sizes="(min-width: 1024px) 18rem, 9rem" priority /> : <span className={styles.question} aria-hidden="true">?</span>}
    </div>
    <strong className={styles.characterName}>{phase === 'rolling' && !over ? copy.rolling : shown?.name.es}</strong>
  </>;
  return <div className={styles.root} data-game-ready="true" data-category-board="" data-phase={phase} data-over={over}>
    <div className={styles.summary}>
      <AttemptsStatus><span>{unlimited ? es.versus.attempt(index + 1) : copy.progress(Math.min(index + 1, limit), limit)}</span></AttemptsStatus>
      <span className={styles.levelBadge}>{copy.levels[level]}</span>
      <strong>{copy.filled(filled)}</strong>
      {!over && <SurrenderButton onConfirm={() => surrender(state.rounds, reportOf(state, false, true), state.draft)} />}
    </div>
    {!unlimited && <SkinAttemptsMeter skin={skin} engine="category-board" mode={session.mode} failed={over && !won ? limit : state.rounds.filter((round) => round.outcome !== 'won').length} won={won} total={limit} />}
    <div className={styles.layout}>
      {failed && !over ? <section className={`${styles.spotlight} ${styles.failedPanel}`} data-part="category-spotlight">
        {portraitContent}
        {!phone && <Button className={styles.retryButton} onClick={action}>{copy.retry}</Button>}
      </section> : <button type="button" className={styles.spotlight} onClick={action} disabled={over || phase === 'choosing'} aria-label={actionLabel} data-part="category-spotlight">
        {portraitContent}
        <span className={styles.actionPrompt} aria-hidden={over || phase === 'choosing'}>{!over && phase !== 'choosing' ? actionLabel : '\u00a0'}</span>
      </button>}
      <div className={styles.board} role="group" aria-label={copy.board} data-part="category-grid" data-outcome={won ? 'won' : failed || lost ? 'failed' : undefined}>
        {categories.map((category) => {
          const placedIndex = placements.indexOf(category.id);
          const occupant = placedIndex >= 0 ? draws[placedIndex] : undefined;
          return <div className={styles.cell} key={category.id} data-filled={!!occupant} data-wildcard={category.wildcard || undefined} data-part="category-cell">
            <button type="button" className={styles.slot} disabled={over || !canPlace || !!occupant} onClick={() => place(category)} aria-label={occupant ? `${category.label}: ${occupant.name.es}` : canPlace ? copy.place(placing.name.es, category.label) : category.label}>
              <span className={styles.slotLabel}>{category.label}</span>
              <span className={styles.occupant}>{occupant?.image && <ContentImage stem={occupant.image} alt="" sizes="2.75rem" />}<span>{occupant ? occupant.name.es : copy.empty}</span></span>
            </button>
            <InfoTip compact text={category.help} label={es.help.button(category.label)} className={styles.help} />
          </div>;
        })}
      </div>
    </div>
    <div className={styles.feedback} data-failed={failed} role="status" aria-live="polite">
      <strong>{message}</strong>
      {failed && !over && !unlimited && <span>{copy.remaining(limit - state.rounds.length)}</span>}
    </div>
    {!over && phone && (phase === 'rolling' || phase === 'placed' || failed) && <DockAction label={actionLabel} detail={copy.filled(filled)} onClick={action} />}
  </div>;
}

'use client';

import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { GameSession, GameShellProps, FinishReport } from '@/components/game-shell/types';
import { useSurrender } from '@/components/game-shell/useSurrender';
import { SurrenderButton } from '@/components/game-shell/SurrenderButton';
import { ContentImage } from '@/components/ContentImage';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { InfoTip } from '@/components/ui/InfoTip';
import { useSkin } from '@/components/skin/context';
import { eligibleEntities } from '@/engine/filters';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { bestBuild, draw, limitFor, outcomeOf, restoreBuild, totalOf, type Assignment } from './logic';
import type { StatBuilderConfig } from './types';
import styles from './StatBuilderGame.module.scss';
import { resultFrame } from './result';
import { ROULETTE_IMAGE_SIZE, useRouletteImages } from './RoulettePreview';

interface Props {
  franchise: GameShellProps['franchise'];
  mode: GameShellProps['mode'];
  modes: GameShellProps['modes'];
  config: StatBuilderConfig;
  entities: readonly Entity[];
}
export function StatBuilderGame({ franchise, mode, modes, config, entities }: Props) {
  const { skin } = useSkin();
  const { ChipMark } = skin.slots;
  const settingsId = useId();
  const [level, setLevel] = useState(1);
  const [regional, setRegional] = useState(false);
  const [mega, setMega] = useState(false);
  const maximum = useMemo(() => Math.max(1, ...entities.flatMap((entity) => config.stats.map((stat) => Number(entity.attrs[stat.key]) || 0))), [entities, config.stats]);
  const available = useMemo(() => entities.filter((entity) => config.stats.every((stat) => typeof entity.attrs[stat.key] === 'number') && (entity.attrs.statForm === 'regional' ? regional : entity.attrs.statForm === 'mega' ? mega : true)), [entities, config.stats, regional, mega]);
  const poolSize = useCallback((active: readonly string[]) => eligibleEntities(available, active).length, [available]);
  return <GameShell franchise={franchise} mode={mode} modes={modes} minimumPool={10} poolSize={poolSize} yesterday={() => null} variant={level === 1 && !regional && !mega ? undefined : `d${level}-r${Number(regional)}-m${Number(mega)}`} help={<>{es.statBuilder.help.map((step) => <p key={step}>{step}</p>)}</>} beforeGame={() => <section className={styles.root} aria-labelledby={settingsId}>
    <div className={styles.settingsHeader}>
      <h2 className={styles.settingsTitle} id={settingsId}>{es.statBuilder.settings}</h2>
      <InfoTip compact text={es.statBuilder.settingsHelp} label={es.help.button(es.statBuilder.settings)} />
    </div>
    <div className={styles.choices} role="group" aria-label={es.statBuilder.difficulty}>
      {config.targets.map((target, index) => <Chip key={target} pressed={index === level} onClick={() => setLevel(index)}>{es.statBuilder.level(index, target)}</Chip>)}
    </div>
    <div className={styles.flags} role="group" aria-label={es.statBuilder.forms}>
      <Chip pressed={regional} mark={<ChipMark on={regional} />} onClick={() => setRegional(!regional)}>{es.statBuilder.regional}</Chip>
      <Chip pressed={mega} mark={<ChipMark on={mega} />} onClick={() => setMega(!mega)}>{es.statBuilder.mega}</Chip>
    </div>
  </section>}>
    {(session) => <StatBuilderBoard session={session} config={config} maximum={maximum} pool={eligibleEntities(available, session.active)} target={config.targets[level]} limit={limitFor(session.attemptLimit ?? 4, level)} />}
  </GameShell>;
}

export function StatBuilderBoard({ session, config, pool, target, limit, maximum }: { session: GameSession; config: StatBuilderConfig; pool: readonly Entity[]; target: number; limit: number; maximum: number }) {
  const [saved] = useState(() => readState(getLocalStorage(), session));
  const [attempts, setAttempts] = useState<Assignment[][]>(() => (saved?.attempts ?? []).map((value) => restoreBuild(value, pool, config)).filter((build) => build.length === config.stats.length));
  const [build, setBuild] = useState(() => restoreBuild(saved?.draft, pool, config));
  const [stopped, setStopped] = useState(false);
  const [preview, setPreview] = useState(0);
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);
  const [resultPhase, setResultPhase] = useState<'idle' | 'running' | 'done'>(() => saved?.result === 'won' || saved?.result === 'lost' ? 'done' : 'idle');
  const [resultElapsed, setResultElapsed] = useState(0);
  const onFinish = session.onFinish;
  const { lost, surrender } = useSurrender(session);
  const complete = build.length === config.stats.length;
  const outcome = outcomeOf(attempts, pool, target, limit);
  const won = outcome.won;
  const over = (outcome.over && resultPhase === 'done') || lost;
  const current = draw(pool, session, attempts.length, build.length);
  const revealedEntity = pool.find((entity) => entity.id === build.at(-1)?.entityId) ?? current;
  const showResult = resultPhase !== 'idle';
  const showStats = !showResult && (awaitingAdvance || complete);
  const reel = useRouletteImages(session.active);
  const resultValues = useMemo(() => config.stats.map((stat) => {
    const assignment = build.find((entry) => entry.key === stat.key);
    return Number(pool.find((entity) => entity.id === assignment?.entityId)?.attrs[stat.key] ?? 0);
  }), [config.stats, build, pool]);
  const optimal = useMemo(() => complete ? bestBuild(build, pool) : [], [complete, build, pool]);
  const result = resultFrame(resultPhase === 'done' ? Infinity : resultElapsed, resultValues);
  const shown = awaitingAdvance || complete ? revealedEntity : stopped ? current : reel[preview % reel.length];

  useEffect(() => {
    if (over || stopped || complete || awaitingAdvance || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setPreview((value) => value + 1), 110);
    return () => window.clearInterval(timer);
  }, [over, stopped, complete, awaitingAdvance]);

  const report = useCallback((all: Assignment[][], success: boolean, fresh: boolean): FinishReport => ({ won: success, title: success ? es.statBuilder.won : es.shell.result.lostTitle, answerIsSentence: true, attempts: all.length, answer: { label: es.statBuilder.result(totalOf(all.at(-1) ?? build, pool), target) }, grid: all.map((attempt) => totalOf(attempt, pool) > target ? '🟩' : '🟥'), fresh }), [build, pool, target]);
  const [restored] = useState(() => over ? report(attempts, won, false) : null);
  useEffect(() => { if (restored) onFinish(restored); }, [restored, onFinish]);

  useEffect(() => {
    if (resultPhase !== 'running') return;
    let frame = 0;
    let start: number | null = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      start ??= now;
      const elapsed = reduced ? Infinity : now - start;
      setResultElapsed(elapsed);
      if (!resultFrame(elapsed, resultValues).done) { frame = requestAnimationFrame(tick); return; }
      setResultPhase('done');
      const finishedOutcome = outcomeOf(attempts, pool, target, limit);
      writeState(getLocalStorage(), session, { attempts, draft: build, result: finishedOutcome.over ? finishedOutcome.won ? 'won' : 'lost' : 'playing' });
      if (finishedOutcome.over) onFinish(report(attempts, finishedOutcome.won, true));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [resultPhase, resultValues, attempts, pool, target, limit, session, build, onFinish, report]);

  function assign(key: string) {
    if (!stopped || over || awaitingAdvance || complete || build.some((value) => value.key === key)) return;
    const next = [...build, { key, entityId: current.id }];
    const finished = next.length === config.stats.length;
    const all = finished ? [...attempts, next] : attempts;
    setBuild(next); setAttempts(all); setAwaitingAdvance(true);
    writeState(getLocalStorage(), session, { attempts: all, draft: next, result: 'playing' });
  }

  return <div className={styles.root} data-game-ready="true" data-over={over}>
    <div className={styles.summary}><p>{es.statBuilder.progress(attempts.length + (complete ? 0 : 1), limit)}</p>{!over && !complete && <SurrenderButton onConfirm={() => surrender(attempts, report(attempts, false, true), build)} />}</div>
    <div className={styles.board}>
      {complete && resultPhase === 'done' ? <div className={styles.spinner}>
        <span className={styles.resultTotal}>{es.statBuilder.fraction(result.total, target)}</span>
        <p className={styles.resultMessage} role="status">{won ? es.statBuilder.won : <><span>{es.statBuilder.retry}</span><span>{es.statBuilder.remaining(Math.max(0, limit - attempts.length))}</span></>}</p>
        {!over && <Button onClick={() => { setBuild([]); setStopped(false); setAwaitingAdvance(false); setResultPhase('idle'); setResultElapsed(0); writeState(getLocalStorage(), session, { attempts, draft: [], result: 'playing' }); }}>{es.statBuilder.next}</Button>}
      </div> :
      <button type="button" className={styles.spinner} onClick={() => { if (complete) { setAwaitingAdvance(false); setResultElapsed(0); setResultPhase('running'); } else if (awaitingAdvance) { setAwaitingAdvance(false); setStopped(false); } else setStopped(true); }} disabled={complete ? resultPhase !== 'idle' || lost : (stopped && !awaitingAdvance) || over} aria-label={complete ? es.statBuilder.viewResult : awaitingAdvance ? es.statBuilder.nextPokemon : es.statBuilder.stop}>
        {!showResult && (shown?.image ? <ContentImage key={shown.id} className={styles.image} stem={shown.image} alt="" sizes={ROULETTE_IMAGE_SIZE} priority /> : <span className={styles.image} aria-hidden="true" />)}
        {!showResult && <strong className={styles.name}>{stopped || complete ? shown?.name.es : "\u00a0"}</strong>}
        {showResult && <span className={styles.resultTotal}>{es.statBuilder.fraction(result.total, target)}</span>}
        <span className={complete || awaitingAdvance ? styles.continuePrompt : undefined}>{complete ? resultPhase === 'idle' ? es.statBuilder.viewResult : resultPhase === 'running' ? es.statBuilder.countingResult : es.statBuilder.finished : over ? es.statBuilder.finished : awaitingAdvance ? es.statBuilder.nextPokemon : stopped ? es.statBuilder.choose : es.statBuilder.stop}</span>
      </button>}
      <div className={styles.slots} role="group" aria-label={es.statBuilder.stats}>
        {config.stats.map((stat, index) => {
          const assignment = build.find((value) => value.key === stat.key);
          return <button type="button" key={stat.key} className={styles.slot} data-locked={!!assignment} disabled={!stopped || !!assignment || over || complete || awaitingAdvance} onClick={() => assign(stat.key)}>
            {(showStats || showResult) && <span className={styles.fill} aria-hidden="true"><span key={`${attempts.length}-${build.length}-${stat.key}`} className={`${styles.fillColor}${showResult ? ` ${styles.resultFill}` : ''}`} style={{ '--fill': (showResult ? result.values[index] : Number(revealedEntity.attrs[stat.key])) / maximum } as CSSProperties} /></span>}
            <span>{stat.label}</span>
            <span className={styles.value}>{showResult ? result.values[index] : showStats ? String(revealedEntity.attrs[stat.key]) : assignment ? es.statBuilder.locked : '—'}</span>
          </button>;
        })}
      </div>
    </div>
    {complete && resultPhase === 'done' && <section className={styles.optimal} aria-label={es.statBuilder.bestTitle}>
      <h2>{es.statBuilder.bestTitle}</h2>
      <p>{es.statBuilder.bestSummary(totalOf(optimal, pool), totalOf(build, pool))}</p>
      <ul className={styles.optimalList}>
        {config.stats.map((stat) => {
          const entry = optimal.find((item) => item.key === stat.key)!;
          const entity = pool.find((item) => item.id === entry.entityId)!;
          const previous = build.find((item) => item.key === stat.key)!;
          return <li key={stat.key} className={styles.optimalItem}>
            {entity.image && <ContentImage stem={entity.image} alt="" sizes="3rem" className={styles.optimalImage} />}
            <div className={styles.optimalDetails}><strong>{stat.label}</strong><p>{entity.name.es} {Number(entity.attrs[stat.key])}
              {previous.entityId !== entry.entityId && <span className={styles.change}>{es.statBuilder.insteadOf(pool.find((item) => item.id === previous.entityId)!.name.es, Number(pool.find((item) => item.id === previous.entityId)!.attrs[stat.key]))}</span>}
            </p></div>
          </li>;
        })}
      </ul>
    </section>}
    <div className={styles.summary}><p role="status">{es.statBuilder.assigned(build.length, config.stats.length)}</p></div>
  </div>;
}

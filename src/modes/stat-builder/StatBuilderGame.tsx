'use client';

import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import { useVersusVariant } from '@/components/versus/VersusGameContext';
import type { GameSession, GameShellProps, FinishReport } from '@/components/game-shell/types';
import { useSurrender } from '@/components/game-shell/useSurrender';
import { useVersusProgress, useVersusStop } from '@/components/game-shell/versus';
import { AttemptsStatus } from '@/components/game-shell/AttemptsStatus';
import { DockAction, useDockTarget } from '@/components/game-shell/GameDock';
import { SurrenderButton } from '@/components/game-shell/SurrenderButton';
import { ContentImage } from '@/components/ContentImage';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { InfoTip } from '@/components/ui/InfoTip';
import { useSkin } from '@/components/skin/context';
import { SkinAttemptsMeter } from '@/components/skin/gameSlots';
import { eligibleEntities } from '@/engine/filters';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { bestBuild, draw, limitFor, playOutcome, playRulesOf, restoreBuild, totalOf, type Assignment } from './logic';
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
  // En versus, nivel y formas salen de la variante de la partida (`d<nivel>-r<0|1>-m<0|1>`; sin variante, los de siempre).
  const versus = useVersusVariant();
  const fixed = versus?.variant?.match(/^d(\d)-r([01])-m([01])$/);
  const [level, setLevel] = useState(() => (fixed && Number(fixed[1]) < config.targets.length ? Number(fixed[1]) : 1));
  const [regional, setRegional] = useState(() => fixed?.[2] === '1');
  const [mega, setMega] = useState(() => fixed?.[3] === '1');
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

export function StatBuilderBoard({ session, config, pool, target: levelTarget, limit: levelLimit, maximum }: { session: GameSession; config: StatBuilderConfig; pool: readonly Entity[]; target: number; limit: number; maximum: number }) {
  const { skin } = useSkin();
  // Las reglas de la partida: las del nivel o, en versus, combinaciones fijas u objetivo con combinaciones ilimitadas.
  const rules = useMemo(() => playRulesOf(session.versus, levelTarget, levelLimit), [session.versus, levelTarget, levelLimit]);
  const { target, limit } = rules;
  const unlimited = !Number.isFinite(limit);
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
  const outcome = playOutcome(attempts, pool, rules);
  const won = outcome.won;
  const over = (outcome.over && resultPhase === 'done') || lost;
  const current = complete ? pool.find((entity) => entity.id === build.at(-1)?.entityId)! : draw(pool, session, attempts.length, build.length, build.map((entry) => entry.entityId));
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
  // La barra de la piel solo cuenta lo que ya se mostró: el intento recién armado queda oculto hasta que termina la cuenta
  // del resultado (si no, la barra adelantaría si se ganó o se perdió).
  const meterWon = won && resultPhase === 'done';
  const meterFailed = Math.max(0, attempts.length - (complete && resultPhase !== 'done' ? 1 : 0) - (meterWon ? 1 : 0));

  useEffect(() => {
    if (over || stopped || complete || awaitingAdvance || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setPreview((value) => value + 1), 110);
    return () => window.clearInterval(timer);
  }, [over, stopped, complete, awaitingAdvance]);

  const report = useCallback((all: Assignment[][], success: boolean, fresh: boolean): FinishReport => ({ won: success, title: success ? es.statBuilder.won : es.shell.result.lostTitle, answerIsSentence: true, attempts: all.length, answer: { label: es.statBuilder.result(totalOf(all.at(-1) ?? build, pool), target) }, grid: all.map((attempt) => totalOf(attempt, pool) > target ? '🟩' : '🟥'), scores: all.map((attempt) => totalOf(attempt, pool)), fresh }), [build, pool, target]);
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
      const finishedOutcome = playOutcome(attempts, pool, rules);
      writeState(getLocalStorage(), session, { attempts, draft: build, result: finishedOutcome.over ? finishedOutcome.won ? 'won' : 'lost' : 'playing' });
      if (finishedOutcome.over) onFinish(report(attempts, finishedOutcome.won, true));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [resultPhase, resultValues, attempts, pool, rules, session, build, onFinish, report]);

  // Versus: lo que ven los rivales (combinaciones y el mejor total) y el cierre desde afuera (tiempo agotado).
  useVersusProgress(session, { attempts: attempts.length, score: attempts.length === 0 ? 0 : Math.max(...attempts.map((attempt) => totalOf(attempt, pool))) });
  useVersusStop(session, over, (stop) => {
    if (stop === 'timeUp') surrender(attempts, { ...report(attempts, false, true), timedOut: true }, build);
  });

  // La tarjeta completa detiene la ruleta también en el teléfono.
  const phone = useDockTarget() !== null;
  const spinDisabled = complete ? resultPhase !== 'idle' || lost : (stopped && !awaitingAdvance) || over;
  const spinPrompt = complete ? resultPhase === 'idle' ? es.statBuilder.viewResult : resultPhase === 'running' ? es.statBuilder.countingResult : es.statBuilder.finished : over ? es.statBuilder.finished : awaitingAdvance ? es.statBuilder.nextPokemon : stopped ? es.statBuilder.choose : es.statBuilder.stop;
  const dockPrompt = complete ? spinPrompt : awaitingAdvance ? es.statBuilder.dockNextPokemon : stopped ? es.statBuilder.choose : es.statBuilder.dockStop;
  function spin() {
    if (complete) { setAwaitingAdvance(false); setResultElapsed(0); setResultPhase('running'); }
    else if (awaitingAdvance) { setAwaitingAdvance(false); setStopped(false); }
    else setStopped(true);
  }
  function retry() {
    setBuild([]); setStopped(false); setAwaitingAdvance(false); setResultPhase('idle'); setResultElapsed(0);
    writeState(getLocalStorage(), session, { attempts, draft: [], result: 'playing' });
  }

  function assign(key: string) {
    if (!stopped || over || awaitingAdvance || complete || build.some((value) => value.key === key)) return;
    const next = [...build, { key, entityId: current.id }];
    const finished = next.length === config.stats.length;
    const all = finished ? [...attempts, next] : attempts;
    setBuild(next); setAttempts(all); setAwaitingAdvance(true);
    writeState(getLocalStorage(), session, { attempts: all, draft: next, result: 'playing' });
  }

  return <div className={styles.root} data-game-ready="true" data-over={over}>
    <div className={styles.summary}><AttemptsStatus><p>{unlimited ? es.versus.attempt(attempts.length + (complete ? 0 : 1)) : es.statBuilder.progress(Math.min(attempts.length + (complete ? 0 : 1), limit), limit)}</p></AttemptsStatus>{!over && !complete && <SurrenderButton onConfirm={() => surrender(attempts, report(attempts, false, true), build)} />}</div>
    {!unlimited && <AttemptsStatus><SkinAttemptsMeter skin={skin} engine="stat-builder" mode={session.mode} failed={meterFailed} won={meterWon} total={limit} /></AttemptsStatus>}
    <div className={styles.board}>
      {complete && resultPhase === 'done' ? <div className={styles.spinner}>
        <span className={styles.resultTotal}>{es.statBuilder.fraction(result.total, target)}</span>
        <p className={styles.resultMessage} role="status">{won && !rules.fixed ? es.statBuilder.won : <><span>{won ? es.statBuilder.won : es.statBuilder.retry}</span>{!unlimited && <span>{es.statBuilder.remaining(Math.max(0, limit - attempts.length))}</span>}</>}</p>
        {!over && !phone && <Button onClick={retry}>{es.statBuilder.next}</Button>}
      </div> :
      (() => {
        const content = <>
          {!showResult && (shown?.image ? <ContentImage className={styles.image} stem={shown.image} alt="" sizes={ROULETTE_IMAGE_SIZE} priority /> : <span className={styles.image} aria-hidden="true" />)}
          {!showResult && <strong className={styles.name}>{stopped || complete ? shown?.name.es : " "}</strong>}
          {showResult && <span className={styles.resultTotal}>{es.statBuilder.fraction(result.total, target)}</span>}
          <span className={complete || awaitingAdvance ? styles.continuePrompt : undefined}>{spinPrompt}</span>
        </>;
        return <button type="button" className={styles.spinner} onClick={spin} disabled={spinDisabled} aria-label={complete ? es.statBuilder.viewResult : awaitingAdvance ? es.statBuilder.nextPokemon : es.statBuilder.stop}>{content}</button>;
      })()}
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
    {!over && (complete || awaitingAdvance) && (complete && resultPhase === 'done'
      ? <DockAction label={es.statBuilder.next} onClick={retry} />
      : <DockAction label={dockPrompt} onClick={spin} disabled={spinDisabled} />)}
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

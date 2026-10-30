'use client';

import { useCallback, useContext, useMemo, useState } from 'react';
import { AttemptRules } from '@/components/game-shell/AttemptRules';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import type { DailyContext } from '@/engine/daily';
import { defaultMinPool, hasMinimumPool } from '@/engine/filters';
import { STORAGE_PREFIX, getLocalStorage } from '@/engine/storage';
import type { Content } from '@/engine/types';
import { es } from '@/i18n/es';
import { LevelPicker } from './LevelPicker';
import { buildPuzzle, configForLevel, countOf, levelsOf, poolOf, withAttemptLimit } from './logic';
import { TimelineBoard } from './TimelineBoard';
import { TimelineHelp } from './TimelineHelp';
import type { TimelineConfig } from './types';

interface TimelineGameProps {
  franchise: ShellFranchise;
  mode: { slug: string; name: string };
  /** Todos los modos de la franquicia, para la navegación del marco. */
  modes: readonly ModeLink[];
  config: TimelineConfig;
  contents: readonly Content[];
}

const MINIMUM_POOL = defaultMinPool('timeline');

/** De qué suceso a cuál iba el orden de un reto, para "Ayer fue…" y el resumen. */
function describe(puzzle: { solution: readonly { text: string }[] }): string {
  return es.timeline.answerLabel(puzzle.solution[0].text, puzzle.solution[puzzle.solution.length - 1].text);
}

/** La dificultad que se eligió la última vez en este modo (desde 0), o la primera. */
function readLevel(franchise: string, mode: string, total: number): number {
  try {
    const value = Number(getLocalStorage()?.getItem(`${STORAGE_PREFIX}:level:${franchise}:${mode}`));
    return Number.isInteger(value) && value >= 0 && value < total ? value : 0;
  } catch {
    return 0;
  }
}

function saveLevel(franchise: string, mode: string, index: number): void {
  try {
    getLocalStorage()?.setItem(`${STORAGE_PREFIX}:level:${franchise}:${mode}`, String(index));
  } catch {
    // Sin almacenamiento, la elección dura mientras la página siga abierta.
  }
}

/**
 * Modos de ordenar sucesos en el tiempo. Es el motor `timeline` montado sobre el marco
 * común (`GameShell`): acá solo está lo que es propio de él, que es cómo se arma el pool de
 * sucesos, la respuesta de ayer, su ayuda y el juego. No sabe de qué franquicia es ni de
 * qué son los sucesos: lo dice la configuración (ver `TimelineConfig`).
 */
export function TimelineGame({ franchise, mode, modes, config: originalConfig, contents }: TimelineGameProps) {
  const rules = useContext(AttemptRules);
  const config = useMemo(() => withAttemptLimit(originalConfig, rules?.base), [originalConfig, rules?.base]);
  const levels = useMemo(() => levelsOf(config), [config]);
  const [levelIndex, setLevelIndex] = useState(() => readLevel(franchise.slug, mode.slug, levels.length));
  const levelConfig = useMemo(() => configForLevel(config, levelIndex), [config, levelIndex]);
  // La primera dificultad es la de siempre (sin variante); las demás son otras partidas (`~d2`, `~d3`). El marco le suma la
  // de los interruptores (relleno, arcos del manga).
  const variant = levelIndex === 0 ? undefined : `d${levelIndex + 1}`;
  const poolSize = useCallback((active: readonly string[]) => poolOf(contents, active, levelConfig).length, [contents, levelConfig]);

  const yesterday = useCallback(
    (ctx: DailyContext, active: readonly string[]): AnswerInfo | null => {
      const pool = poolOf(contents, active, levelConfig);
      if (!hasMinimumPool(pool.length, MINIMUM_POOL)) return null;
      // El reto de ayer de la misma dificultad y con los mismos interruptores: el marco ya pasa la variante en `filterKey`.
      const puzzle = buildPuzzle(pool, { ...ctx, day: ctx.day - 1 }, countOf(levelConfig));
      return puzzle ? { label: describe(puzzle) } : null;
    },
    [contents, levelConfig],
  );

  return (
    <GameShell
      franchise={franchise}
      mode={mode}
      modes={modes}
      minimumPool={MINIMUM_POOL}
      poolSize={poolSize}
      yesterday={yesterday}
      help={<TimelineHelp config={config} />}
      variant={variant}
      beforeGame={
        levels.length > 1
          ? ({ remaining }) => (
              <LevelPicker
                levels={levels}
                selected={levelIndex}
                available={remaining}
                onSelect={(index) => {
                  saveLevel(franchise.slug, mode.slug, index);
                  setLevelIndex(index);
                }}
              />
            )
          : undefined
      }
    >
      {(session) => <TimelineSession session={session} config={levelConfig} contents={contents} many={levels.length > 1} />}
    </GameShell>
  );
}

interface TimelineSessionProps {
  session: GameSession;
  /** La configuración con la dificultad elegida (sus sucesos e intentos). */
  config: TimelineConfig;
  contents: readonly Content[];
  /** Hay varias dificultades: si no alcanzan los sucesos, el aviso sugiere una más fácil. */
  many: boolean;
}

/** El juego de una combinación de series: elige los sucesos del día una vez por combinación. */
function TimelineSession({ session, config, contents, many }: TimelineSessionProps) {
  const { franchise, mode, filterKey, day, active } = session;
  const puzzle = useMemo(
    () => buildPuzzle(poolOf(contents, active, config), { franchise, mode, filterKey, day }, countOf(config)),
    [contents, active, config, franchise, mode, filterKey, day],
  );

  if (puzzle === null) return <p role="status">{many ? es.timeline.noPuzzleLevel : es.timeline.noPuzzle}</p>;
  return <TimelineBoard session={session} config={config} puzzle={puzzle} />;
}

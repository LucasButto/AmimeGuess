'use client';

import { useCallback, useMemo } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import type { DailyContext } from '@/engine/daily';
import { defaultMinPool, hasMinimumPool } from '@/engine/filters';
import type { Content } from '@/engine/types';
import { es } from '@/i18n/es';
import { buildPuzzle, countOf, poolOf } from './logic';
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

/**
 * Modos de ordenar sucesos en el tiempo. Es el motor `timeline` montado sobre el marco
 * común (`GameShell`): acá solo está lo que es propio de él, que es cómo se arma el pool de
 * sucesos, la respuesta de ayer, su ayuda y el juego. No sabe de qué franquicia es ni de
 * qué son los sucesos: lo dice la configuración (ver `TimelineConfig`).
 */
export function TimelineGame({ franchise, mode, modes, config, contents }: TimelineGameProps) {
  const poolSize = useCallback((active: readonly string[]) => poolOf(contents, active, config).length, [contents, config]);

  const yesterday = useCallback(
    (ctx: DailyContext, active: readonly string[]): AnswerInfo | null => {
      const pool = poolOf(contents, active, config);
      if (!hasMinimumPool(pool.length, MINIMUM_POOL)) return null;
      const puzzle = buildPuzzle(pool, { ...ctx, day: ctx.day - 1 }, countOf(config));
      return puzzle ? { label: describe(puzzle) } : null;
    },
    [contents, config],
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
    >
      {(session) => <TimelineSession session={session} config={config} contents={contents} />}
    </GameShell>
  );
}

interface TimelineSessionProps {
  session: GameSession;
  config: TimelineConfig;
  contents: readonly Content[];
}

/** El juego de una combinación de series: elige los sucesos del día una vez por combinación. */
function TimelineSession({ session, config, contents }: TimelineSessionProps) {
  const { franchise, mode, filterKey, day, active } = session;
  const puzzle = useMemo(
    () => buildPuzzle(poolOf(contents, active, config), { franchise, mode, filterKey, day }, countOf(config)),
    [contents, active, config, franchise, mode, filterKey, day],
  );

  if (puzzle === null) return <p role="status">{es.timeline.noPuzzle}</p>;
  return <TimelineBoard session={session} config={config} puzzle={puzzle} />;
}

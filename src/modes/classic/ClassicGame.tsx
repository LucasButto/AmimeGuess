'use client';

import { useCallback, useMemo } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import { yesterday as yesterdayOf, type DailyContext } from '@/engine/daily';
import { defaultMinPool, eligibleEntities, hasMinimumPool } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { ClassicBoard } from './ClassicBoard';
import { ClassicHelp } from './ClassicHelp';
import { visibleColumns } from './logic';
import type { ClassicConfig } from './types';

interface ClassicGameProps {
  franchise: ShellFranchise;
  mode: { slug: string; name: string };
  /** Todos los modos de la franquicia, para la navegación del marco. */
  modes: readonly ModeLink[];
  config: ClassicConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
}

const MINIMUM_POOL = defaultMinPool('classic');

/**
 * Modo Clásico: se adivina una entidad por la tabla de atributos de sus
 * intentos. Es el motor `classic` montado sobre el marco común (`GameShell`):
 * acá solo está lo que es propio de él, que es cómo se arma el pool, la
 * respuesta de ayer, su ayuda y el juego. No sabe de qué franquicia es.
 */
export function ClassicGame({ franchise, mode, modes, config, entities, contents }: ClassicGameProps) {
  const poolSize = useCallback((active: readonly string[]) => eligibleEntities(entities, active).length, [entities]);

  const yesterday = useCallback(
    (ctx: DailyContext, active: readonly string[]): AnswerInfo | null => {
      const pool = eligibleEntities(entities, active);
      if (!hasMinimumPool(pool.length, MINIMUM_POOL)) return null;
      const answer = yesterdayOf(pool, ctx);
      return { label: answer.name.es, imageStem: answer.image };
    },
    [entities],
  );

  return (
    <GameShell
      franchise={franchise}
      mode={mode}
      modes={modes}
      minimumPool={MINIMUM_POOL}
      poolSize={poolSize}
      yesterday={yesterday}
      help={<ClassicHelp config={config} />}
    >
      {(session) => <ClassicSession session={session} config={config} entities={entities} contents={contents} />}
    </GameShell>
  );
}

interface ClassicSessionProps {
  session: GameSession;
  config: ClassicConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
}

/** El juego de una combinación de series: calcula su pool y sus columnas una vez por combinación. */
function ClassicSession({ session, config, entities, contents }: ClassicSessionProps) {
  const pool = useMemo(() => eligibleEntities(entities, session.active), [entities, session.active]);
  const columns = useMemo(() => visibleColumns(config.columns, session.active), [config.columns, session.active]);
  return <ClassicBoard session={session} pool={pool} columns={columns} hints={config.hints} contents={contents} />;
}

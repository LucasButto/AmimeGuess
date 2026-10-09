'use client';

import { useCallback, useMemo } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import type { DailyContext } from '@/engine/daily';
import { defaultMinPool, hasMinimumPool } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { ConnectionsBoard } from './ConnectionsBoard';
import { ConnectionsHelp } from './ConnectionsHelp';
import { buildBoard, poolOf } from './logic';
import type { ConnectionsConfig } from './types';

interface ConnectionsGameProps {
  franchise: ShellFranchise;
  mode: { slug: string; name: string };
  /** Todos los modos de la franquicia, para la navegación del marco. */
  modes: readonly ModeLink[];
  config: ConnectionsConfig;
  /** Las entidades que son los elementos del tablero: de ellas salen los nombres. */
  entities: readonly Entity[];
  contents: readonly Content[];
}

const MINIMUM_POOL = defaultMinPool('connections');

/**
 * Modos de agrupar 16 elementos en 4 grupos. Es el motor `connections` montado sobre el marco
 * común (`GameShell`): acá solo está lo que es propio de él, que es cómo se arma el pool de
 * grupos, la respuesta de ayer, su ayuda y el juego. No sabe de qué franquicia es ni de qué son
 * los grupos: lo dice la configuración (ver `ConnectionsConfig`).
 */
export function ConnectionsGame({ franchise, mode, modes, config, entities, contents }: ConnectionsGameProps) {
  const names = useMemo(() => new Map(entities.map((entity) => [entity.id, entity.name.es])), [entities]);

  const poolSize = useCallback(
    (active: readonly string[]) => poolOf(entities, contents, active, config).length,
    [entities, contents, config],
  );

  const yesterday = useCallback(
    (ctx: DailyContext, active: readonly string[]): AnswerInfo | null => {
      const pool = poolOf(entities, contents, active, config);
      if (!hasMinimumPool(pool.length, MINIMUM_POOL)) return null;
      const board = buildBoard(pool, { ...ctx, day: ctx.day - 1 });
      return board ? { label: es.connections.answerLabel(board.groups.map((group) => group.name)) } : null;
    },
    [entities, contents, config],
  );

  return (
    <GameShell
      franchise={franchise}
      mode={mode}
      modes={modes}
      minimumPool={MINIMUM_POOL}
      poolSize={poolSize}
      yesterday={yesterday}
      help={<ConnectionsHelp config={config} />}
    >
      {(session) => <ConnectionsSession session={session} config={config} entities={entities} contents={contents} names={names} />}
    </GameShell>
  );
}

interface ConnectionsSessionProps {
  session: GameSession;
  config: ConnectionsConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
  names: ReadonlyMap<string, string>;
}

/** El juego de una combinación de series: arma el tablero del día una vez por combinación. */
function ConnectionsSession({ session, config, entities, contents, names }: ConnectionsSessionProps) {
  const { franchise, mode, filterKey, day, active } = session;
  const board = useMemo(
    () => buildBoard(poolOf(entities, contents, active, config), { franchise, mode, filterKey, day }),
    [entities, contents, active, config, franchise, mode, filterKey, day],
  );

  if (board === null) return <p role="status">{es.connections.noPuzzle}</p>;
  return <ConnectionsBoard session={session} config={config} board={board} names={names} />;
}

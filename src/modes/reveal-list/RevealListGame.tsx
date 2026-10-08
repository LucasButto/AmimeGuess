'use client';

import { useCallback, useMemo } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import { yesterday as yesterdayOf, type DailyContext } from '@/engine/daily';
import { defaultMinPool, eligibleEntities, hasMinimumPool } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { candidatesOf } from './logic';
import { RevealListBoard } from './RevealListBoard';
import { RevealListHelp } from './RevealListHelp';
import type { RevealListConfig } from './types';

interface RevealListGameProps {
  franchise: ShellFranchise;
  mode: { slug: string; name: string };
  /** Todos los modos de la franquicia, para la navegación del marco. */
  modes: readonly ModeLink[];
  config: RevealListConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
}

const MINIMUM_POOL = defaultMinPool('reveal-list');

/**
 * Modos de lista de pistas: se ve una y cada intento fallido revela otra. Es el
 * motor `reveal-list` montado sobre el marco común (`GameShell`): acá solo está
 * lo que es propio de él, que es cómo se arma el pool de respuestas, la
 * respuesta de ayer, su ayuda y el juego. No sabe de qué franquicia es ni qué
 * lista muestra: lo dice la configuración (ver `RevealListConfig`).
 */
export function RevealListGame({ franchise, mode, modes, config, entities, contents }: RevealListGameProps) {
  const poolSize = useCallback(
    (active: readonly string[]) => candidatesOf(entities, contents, active, config).length,
    [entities, contents, config],
  );

  const yesterday = useCallback(
    (ctx: DailyContext, active: readonly string[]): AnswerInfo | null => {
      const pool = candidatesOf(entities, contents, active, config);
      if (!hasMinimumPool(pool.length, MINIMUM_POOL)) return null;
      const answer = yesterdayOf(pool, ctx);
      return { label: answer.entity.name.es, imageStem: answer.entity.image };
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
      help={<RevealListHelp />}
    >
      {(session) => <RevealListSession session={session} config={config} entities={entities} contents={contents} />}
    </GameShell>
  );
}

interface RevealListSessionProps {
  session: GameSession;
  config: RevealListConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
}

/** El juego de una combinación de series: calcula sus respuestas posibles y sus opciones una vez por combinación. */
function RevealListSession({ session, config, entities, contents }: RevealListSessionProps) {
  const candidates = useMemo(
    () => candidatesOf(entities, contents, session.active, config),
    [entities, contents, session.active, config],
  );
  // Se puede intentar con cualquier entidad elegible, tenga o no lista propia.
  const options = useMemo(() => eligibleEntities(entities, session.active), [entities, session.active]);
  return <RevealListBoard session={session} config={config} candidates={candidates} options={options} />;
}

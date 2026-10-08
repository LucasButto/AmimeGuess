'use client';

import { useCallback, useMemo } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import { yesterday as yesterdayOf, type DailyContext } from '@/engine/daily';
import { defaultMinPool, eligibleEntities, hasMinimumPool } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { candidatesOf } from './logic';
import { TextClueBoard } from './TextClueBoard';
import { TextClueHelp } from './TextClueHelp';
import type { TextClueConfig } from './types';

interface TextClueGameProps {
  franchise: ShellFranchise;
  mode: { slug: string; name: string };
  /** Todos los modos de la franquicia, para la navegación del marco. */
  modes: readonly ModeLink[];
  config: TextClueConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
}

const MINIMUM_POOL = defaultMinPool('text-clue');

/**
 * Modos de pista de texto: una descripción, un movimiento, una frase o unos
 * emojis. Es el motor `text-clue` montado sobre el marco común (`GameShell`):
 * acá solo está lo que es propio de él, que es cómo se arma el pool de
 * respuestas, la respuesta de ayer, su ayuda y el juego. No sabe de qué
 * franquicia es ni de dónde sale el texto: lo dice la configuración (ver
 * `TextClueConfig`).
 */
export function TextClueGame({ franchise, mode, modes, config, entities, contents }: TextClueGameProps) {
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
      help={<TextClueHelp config={config} />}
    >
      {(session) => <TextClueSession session={session} config={config} entities={entities} contents={contents} />}
    </GameShell>
  );
}

interface TextClueSessionProps {
  session: GameSession;
  config: TextClueConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
}

/** El juego de una combinación de series: calcula sus respuestas posibles y sus opciones una vez por combinación. */
function TextClueSession({ session, config, entities, contents }: TextClueSessionProps) {
  const candidates = useMemo(
    () => candidatesOf(entities, contents, session.active, config),
    [entities, contents, session.active, config],
  );
  // Se puede intentar con cualquier entidad elegible, tenga o no contenido propio.
  const options = useMemo(() => eligibleEntities(entities, session.active), [entities, session.active]);
  return <TextClueBoard session={session} config={config} candidates={candidates} options={options} />;
}

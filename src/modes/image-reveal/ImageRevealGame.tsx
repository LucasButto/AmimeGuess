'use client';

import { useCallback, useMemo } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import { yesterday as yesterdayOf, type DailyContext } from '@/engine/daily';
import { defaultMinPool, eligibleEntities, hasMinimumPool } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { ImageRevealBoard } from './ImageRevealBoard';
import { ImageRevealHelp } from './ImageRevealHelp';
import { candidatesOf } from './logic';
import type { ImageRevealConfig } from './types';

interface ImageRevealGameProps {
  franchise: ShellFranchise;
  mode: { slug: string; name: string };
  /** Todos los modos de la franquicia, para la navegación del marco. */
  modes: readonly ModeLink[];
  config: ImageRevealConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
}

const MINIMUM_POOL = defaultMinPool('image-reveal');

/**
 * Modos de imagen oculta: silueta, desenfoque o zoom. Es el motor `image-reveal`
 * montado sobre el marco común (`GameShell`): acá solo está lo que es propio de
 * él, que es cómo se arma el pool de respuestas, la respuesta de ayer, su ayuda y
 * el juego. No sabe de qué franquicia es ni de dónde sale la imagen: lo dice la
 * configuración (ver `ImageRevealConfig`).
 */
export function ImageRevealGame({ franchise, mode, modes, config, entities, contents }: ImageRevealGameProps) {
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
      help={<ImageRevealHelp variant={config.variant} />}
    >
      {(session) => <ImageRevealSession session={session} config={config} entities={entities} contents={contents} />}
    </GameShell>
  );
}

interface ImageRevealSessionProps {
  session: GameSession;
  config: ImageRevealConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
}

/** El juego de una combinación de series: calcula sus respuestas posibles y sus opciones una vez por combinación. */
function ImageRevealSession({ session, config, entities, contents }: ImageRevealSessionProps) {
  const candidates = useMemo(
    () => candidatesOf(entities, contents, session.active, config),
    [entities, contents, session.active, config],
  );
  // Se puede intentar con cualquier entidad elegible, tenga o no imagen propia.
  const options = useMemo(() => eligibleEntities(entities, session.active), [entities, session.active]);
  return <ImageRevealBoard session={session} config={config} candidates={candidates} options={options} />;
}

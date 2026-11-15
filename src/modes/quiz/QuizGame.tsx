'use client';

import { useCallback, useMemo } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import type { DailyContext } from '@/engine/daily';
import { defaultMinPool, hasMinimumPool } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { optionCountOf, poolOf, questionOf } from './logic';
import { QuizBoard, type QuizOption } from './QuizBoard';
import { QuizHelp } from './QuizHelp';
import type { QuizConfig } from './types';

interface QuizGameProps {
  franchise: ShellFranchise;
  mode: { slug: string; name: string };
  /** Todos los modos de la franquicia, para la navegación del marco. */
  modes: readonly ModeLink[];
  config: QuizConfig;
  /** Las entidades que son las opciones: de ellas salen los nombres y los retratos. */
  entities: readonly Entity[];
  contents: readonly Content[];
}

const MINIMUM_POOL = defaultMinPool('quiz');

/**
 * Modos de contestar una pregunta por día eligiendo entre varias opciones. Es el motor `quiz` montado sobre el marco
 * común (`GameShell`): acá solo está lo que es propio de él, que es cómo se arma el pool de preguntas, la respuesta de
 * ayer, su ayuda y el juego. No sabe de qué franquicia es ni de qué son las preguntas: lo dice la configuración (ver
 * `QuizConfig`).
 */
export function QuizGame({ franchise, mode, modes, config, entities, contents }: QuizGameProps) {
  const options = useMemo<ReadonlyMap<string, QuizOption>>(
    () => new Map(entities.map((entity) => [entity.id, { id: entity.id, name: entity.name.es, image: entity.image }])),
    [entities],
  );
  const poolSize = useCallback((active: readonly string[]) => poolOf(entities, contents, active, config).length, [entities, contents, config]);

  const yesterday = useCallback(
    (ctx: DailyContext, active: readonly string[]): AnswerInfo | null => {
      const pool = poolOf(entities, contents, active, config);
      if (!hasMinimumPool(pool.length, MINIMUM_POOL)) return null;
      // La pregunta de ayer con los mismos interruptores: el marco ya pasa la variante en `filterKey`.
      const answer = options.get(questionOf(pool, { ...ctx, day: ctx.day - 1 })?.correct ?? '');
      return answer ? { label: answer.name, imageStem: answer.image } : null;
    },
    [entities, contents, config, options],
  );

  return (
    <GameShell
      franchise={franchise}
      mode={mode}
      modes={modes}
      minimumPool={MINIMUM_POOL}
      poolSize={poolSize}
      yesterday={yesterday}
      help={<QuizHelp config={config} />}
    >
      {(session) => <QuizSession session={session} config={config} entities={entities} contents={contents} options={options} />}
    </GameShell>
  );
}

interface QuizSessionProps {
  session: GameSession;
  config: QuizConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
  options: ReadonlyMap<string, QuizOption>;
}

/** El juego de una combinación de series: elige la pregunta del día una vez por combinación. */
function QuizSession({ session, config, entities, contents, options }: QuizSessionProps) {
  const { franchise, mode, filterKey, day, active } = session;
  const question = useMemo(
    () => questionOf(poolOf(entities, contents, active, config), { franchise, mode, filterKey, day }),
    [entities, contents, active, config, franchise, mode, filterKey, day],
  );

  if (question === null) return <p role="status">{es.quiz.noPuzzle}</p>;
  return <QuizBoard session={session} question={question} optionCount={optionCountOf(config)} options={options} />;
}

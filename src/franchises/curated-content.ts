import type { Content } from '../engine/types';

interface CuratedRow {
  id: string;
  series: string;
  text: string;
  verified: boolean;
}

export function quoteContent(
  quote: CuratedRow & { character: string },
  details: Record<string, unknown>,
): Content {
  return {
    id: `quote-${quote.id}`,
    kind: 'quote',
    entityId: quote.character,
    series: quote.series,
    payload: { text: quote.text, ...details },
    verified: quote.verified,
  };
}

export function eventContents(
  events: readonly (CuratedRow & { order: number; filler?: boolean; mangaOnly?: boolean })[],
  series: readonly string[] = [],
): Content[] {
  const sorted = [...events].sort((a, b) => series.indexOf(a.series) - series.indexOf(b.series) || a.order - b.order);
  const orders = new Map(sorted.map(({ id }, index) => [id, index + 1]));
  return events.map(({ id, series, text, verified, filler, mangaOnly }) => ({
    id: `event-${id}`,
    kind: 'event',
    series,
    verified,
    payload: {
      text,
      order: orders.get(id),
      ...(filler ? { filler: true } : {}),
      ...(mangaOnly ? { mangaOnly: true } : {}),
    },
  }));
}

/**
 * Las preguntas del Quiz: la respuesta correcta y los distractores son ids de entidades (las opciones). La explicación
 * acompaña a la pregunta; el alcance dice a qué parte de la historia se refiere. La página donde se verificó cada dato
 * (`source`) queda en el archivo de datos y no viaja en el `payload`: no es un texto copiado, así que no es una
 * atribución de /creditos (que sale de `payload.source`).
 */
export function questionContents(
  questions: readonly {
    id: string;
    series: string;
    question: string;
    scope: string;
    type: string;
    correct: string;
    distractors: readonly string[];
    explanation: string;
    verified: boolean;
  }[],
): Content[] {
  return questions.map(({ id, series, question, scope, type, correct, distractors, explanation, verified }) => ({
    id: `question-${id}`,
    kind: 'question',
    series,
    verified,
    payload: { question, scope, type, correct, distractors: [...distractors], explanation },
  }));
}

/** Los grupos de Conexiones: `members` lista a TODOS los del grupo (de ahí sale la solución única del tablero). */
export function groupContents(
  groups: readonly { id: string; series: string; name: string; category: string; difficulty: number; members: readonly string[]; verified: boolean }[],
): Content[] {
  return groups.map(({ id, series, name, category, difficulty, members, verified }) => ({
    id: `group-${id}`,
    kind: 'group',
    series,
    verified,
    payload: { name, category, difficulty, members: [...members] },
  }));
}

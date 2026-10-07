import type { AttrValue } from './types';

// Comparación de atributos del modo Clásico (SPEC 3.4): `=` exacta,
// `⊂` conjunto y `↕` ordenable. Para los atributos de tipo conjunto con
// etiquetas de serie, aplicar antes `filterAttrValue` (regla 3).

export type ExactMatch = 'exact' | 'none';
export type SetMatch = 'exact' | 'partial' | 'none';
/** Hacia dónde está la respuesta respecto del intento: `up` es mayor, `down` es menor. */
export type Direction = 'up' | 'down';

export interface OrderedComparison {
  match: ExactMatch;
  /** `null` si coincide o si alguno de los dos valores no se puede ordenar. */
  direction: Direction | null;
}

function toValueSet(value: AttrValue): Set<string> {
  if (value === null) return new Set();
  if (Array.isArray(value)) {
    return new Set(value.map((item) => (typeof item === 'string' ? item : item.value)));
  }
  return new Set([String(value)]);
}

/**
 * Conjunto: `exact` si tienen los mismos valores, `partial` si comparten
 * alguno pero no todos, `none` si no comparten ninguno. `null` y la lista
 * vacía son el conjunto vacío: dos vacíos coinciden; uno vacío y otro no, no.
 */
export function compareSet(guess: AttrValue, answer: AttrValue): SetMatch {
  const guessValues = toValueSet(guess);
  const answerValues = toValueSet(answer);
  if (guessValues.size === 0 && answerValues.size === 0) return 'exact';

  let shared = 0;
  for (const value of guessValues) {
    if (answerValues.has(value)) shared++;
  }
  if (shared === 0) return 'none';
  return shared === guessValues.size && shared === answerValues.size ? 'exact' : 'partial';
}

/**
 * Exacta: los valores son iguales. `null` coincide con `null` (por ejemplo, un
 * Pokémon sin segundo tipo contra otro sin segundo tipo). Si alguno es una
 * lista, se comparan como conjuntos y solo cuenta la coincidencia total.
 */
export function compareExact(guess: AttrValue, answer: AttrValue): ExactMatch {
  if (Array.isArray(guess) || Array.isArray(answer)) {
    return compareSet(guess, answer) === 'exact' ? 'exact' : 'none';
  }
  return guess === answer ? 'exact' : 'none';
}

/**
 * Ordenable: solo compara números. Si coinciden, `exact`; si no, `none` con la
 * dirección en la que está la respuesta. Si alguno no es un número finito no
 * hay dirección; dos `null` coinciden.
 */
export function compareOrdered(guess: AttrValue, answer: AttrValue): OrderedComparison {
  if (guess === null && answer === null) return { match: 'exact', direction: null };
  if (
    typeof guess !== 'number' ||
    typeof answer !== 'number' ||
    !Number.isFinite(guess) ||
    !Number.isFinite(answer)
  ) {
    return { match: 'none', direction: null };
  }
  if (guess === answer) return { match: 'exact', direction: null };
  return { match: 'none', direction: answer > guess ? 'up' : 'down' };
}

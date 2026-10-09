// Lógica pura del motor `connections`. Sin React y sin nada de ninguna franquicia:
// recibe la configuración, las entidades y los contenidos por parámetro. El tablero
// de un día sale de `seedFor(ctx)` sobre el pool ordenado por id (SPEC 5, "Modos de
// secuencia"): nunca de azar ni de un reloj, así dos personas con los mismos filtros
// ven los mismos 16 elementos en el mismo desorden.
//
// Solución única. Un tablero lleva 4 grupos y 4 elementos de cada uno. Un elemento
// solo entra al tablero si NO pertenece a ninguno de los otros tres grupos elegidos
// (se mira la lista completa de miembros de cada grupo, no solo los que podrían
// salir). Así cada elemento tiene un único grupo posible y la partición en 4 grupos de
// 4 es única.

import { seedFor, type DailyContext } from '@/engine/daily';
import { eligibleContents, eligibleEntities } from '@/engine/filters';
import { mulberry32, pickN, shuffle } from '@/engine/rng';
import type { Content, Entity } from '@/engine/types';
import { DEFAULT_MISTAKES, DIFFICULTIES, GROUP_SIZE, type ConnectionsConfig } from './types';

export const mistakesOf = (config: ConnectionsConfig): number => config.mistakes ?? DEFAULT_MISTAKES;

// --- Pool ---------------------------------------------------------------------

/** Un grupo que puede entrar a un tablero con las series activas. */
export interface Group {
  readonly id: string;
  readonly name: string;
  readonly difficulty: number;
  /** TODOS los que pertenecen al grupo, estén o no entre los elegibles. */
  readonly members: ReadonlySet<string>;
  /** Los miembros que son entidades elegibles (regla 1), ordenados por id: de entre ellos salen los del tablero. */
  readonly available: readonly string[];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Los grupos usables con las series activas: contenidos elegibles (regla 2) del tipo de la
 * configuración, bien formados y con al menos `GROUP_SIZE` miembros que sean entidades
 * elegibles. Ordenados por id: de ese orden depende la elección, así que no puede
 * depender del de los datos.
 */
export function groupsOf(
  entities: readonly Entity[],
  contents: readonly Content[],
  active: readonly string[],
  config: ConnectionsConfig,
): Group[] {
  const eligibleIds = new Set(eligibleEntities(entities, active).map((entity) => entity.id));
  const groups: Group[] = [];
  for (const content of eligibleContents(contents, active)) {
    if (content.kind !== config.contentKind) continue;
    const name = content.payload[config.nameField];
    const difficulty = content.payload[config.difficultyField];
    const members = content.payload[config.membersField];
    if (typeof name !== 'string' || name.length === 0) continue;
    if (typeof difficulty !== 'number' || !DIFFICULTIES.includes(difficulty)) continue;
    if (!Array.isArray(members)) continue;
    const ids = new Set(members.filter((id): id is string => typeof id === 'string'));
    const available = [...ids].filter((id) => eligibleIds.has(id)).sort(compare);
    if (available.length < GROUP_SIZE) continue;
    groups.push({ id: content.id, name, difficulty, members: ids, available });
  }
  return groups.sort((a, b) => compare(a.id, b.id));
}

/** Los miembros de `group` que no pertenecen a ninguno de los otros grupos de la combinación: los que pueden salir en el tablero. */
function exclusiveOf(group: Group, combination: readonly Group[]): string[] {
  const others = combination.filter((other) => other !== group);
  return group.available.filter((id) => others.every((other) => !other.members.has(id)));
}

/** ¿Alcanza cada grupo de la combinación con elementos que no estén en los otros tres? */
function isPlayable(combination: readonly Group[]): boolean {
  return combination.every((group) => exclusiveOf(group, combination).length >= GROUP_SIZE);
}

/**
 * Recorre las combinaciones de un grupo por dificultad, en el orden en que vienen los
 * niveles. `visit` recibe la combinación (se reutiliza: copiarla si se guarda) y devuelve
 * `true` para cortar el recorrido.
 */
function walkCombinations(levels: readonly (readonly Group[])[], visit: (combination: readonly Group[]) => boolean): void {
  const combination: Group[] = [];
  function walk(depth: number): boolean {
    if (depth === levels.length) return visit(combination);
    for (const group of levels[depth]) {
      combination[depth] = group;
      if (walk(depth + 1)) return true;
    }
    return false;
  }
  walk(0);
}

function byDifficulty(groups: readonly Group[]): Group[][] {
  return DIFFICULTIES.map((difficulty) => groups.filter((group) => group.difficulty === difficulty));
}

/**
 * Los grupos que forman parte de algún tablero posible con las series activas. Es lo que
 * cuenta para el pool mínimo (regla 6 de la SPEC): "grupos completos", o sea que se pueden
 * jugar. Si falta una dificultad, o ninguna combinación tiene elementos de sobra, no hay
 * ninguno. Ordenados por id.
 */
export function poolOf(
  entities: readonly Entity[],
  contents: readonly Content[],
  active: readonly string[],
  config: ConnectionsConfig,
): Group[] {
  const groups = groupsOf(entities, contents, active, config);
  const levels = byDifficulty(groups);
  if (levels.some((level) => level.length === 0)) return [];
  const used = new Set<Group>();
  walkCombinations(levels, (combination) => {
    if (isPlayable(combination)) combination.forEach((group) => used.add(group));
    return false;
  });
  return groups.filter((group) => used.has(group));
}

// --- El tablero de un día --------------------------------------------------------

/** Un grupo del tablero con los `GROUP_SIZE` elementos que salieron. */
export interface BoardGroup {
  readonly id: string;
  readonly name: string;
  readonly difficulty: number;
  /** Ordenados por id. */
  readonly members: readonly string[];
}

export interface Board {
  /** Los grupos del día, del más fácil al más difícil: la solución. */
  readonly groups: readonly BoardGroup[];
  /** Los 16 elementos como se ven al empezar, de a `GROUP_SIZE` por fila: ninguna fila es un grupo entero. */
  readonly start: readonly string[];
}

/** ¿Alguna fila de la grilla (de a `GROUP_SIZE` seguidos) ya es un grupo entero? */
export function hasSolvedRow(arrangement: readonly string[], groups: readonly BoardGroup[]): boolean {
  for (let from = 0; from < arrangement.length; from += GROUP_SIZE) {
    const row = arrangement.slice(from, from + GROUP_SIZE);
    if (groups.some((group) => row.every((id) => group.members.includes(id)))) return true;
  }
  return false;
}

/**
 * El tablero del día: un grupo de cada dificultad, `GROUP_SIZE` elementos de cada uno que no
 * pertenezcan a ninguno de los otros tres, y el desorden con el que arrancan. `pool` es lo que
 * devuelve `poolOf`. `null` si no hay ninguna combinación posible.
 *
 * Los grupos de cada dificultad se mezclan con el PRNG del día y se toma la primera combinación
 * que alcanza, así que el resultado depende solo de `ctx` y del pool.
 */
export function buildBoard(pool: readonly Group[], ctx: DailyContext): Board | null {
  const rng = mulberry32(seedFor(ctx));
  const levels = byDifficulty([...pool].sort((a, b) => compare(a.id, b.id))).map((level) => shuffle(rng, level));
  if (levels.some((level) => level.length === 0)) return null;

  let chosen: Group[] | null = null;
  walkCombinations(levels, (combination) => {
    if (!isPlayable(combination)) return false;
    chosen = [...combination];
    return true;
  });
  if (chosen === null) return null;
  const combination: Group[] = chosen;

  const groups: BoardGroup[] = combination.map((group) => ({
    id: group.id,
    name: group.name,
    difficulty: group.difficulty,
    members: pickN(rng, exclusiveOf(group, combination), GROUP_SIZE).sort(compare),
  }));
  const ids = groups.flatMap((group) => group.members);

  let start = shuffle(rng, ids);
  // Con 16 al azar es rarísimo, pero una fila que ya es un grupo regalaría una pista: se vuelve a mezclar.
  for (let tries = 0; tries < 20 && hasSolvedRow(start, groups); tries++) start = shuffle(rng, ids);
  return { groups, start };
}

// --- Evaluar una selección -------------------------------------------------------

export type Verdict =
  | { readonly kind: 'correct'; readonly group: BoardGroup }
  /** Tres de los cuatro elegidos son de un mismo grupo. */
  | { readonly kind: 'oneAway' }
  | { readonly kind: 'wrong' };

/** Qué grupo (de `candidates`, los que faltan resolver) forman los elegidos, o qué tan cerca estuvieron. */
export function judge(selection: readonly string[], candidates: readonly BoardGroup[]): Verdict {
  let best = 0;
  for (const group of candidates) {
    const hits = selection.filter((id) => group.members.includes(id)).length;
    if (hits === GROUP_SIZE && selection.length === GROUP_SIZE) return { kind: 'correct', group };
    best = Math.max(best, hits);
  }
  return best === GROUP_SIZE - 1 ? { kind: 'oneAway' } : { kind: 'wrong' };
}

export interface Progress {
  /** Los grupos resueltos, en el orden en que se resolvieron. Al resolver el tercero, el cuarto queda resuelto solo. */
  readonly solved: readonly BoardGroup[];
  readonly mistakes: number;
  readonly won: boolean;
  /** Ya no se puede seguir: se resolvió o se gastaron los errores. */
  readonly over: boolean;
}

/** El estado de una partida a partir de las selecciones enviadas, en orden. */
export function progressOf(attempts: readonly (readonly string[])[], board: Board, maxMistakes: number): Progress {
  const solved: BoardGroup[] = [];
  let mistakes = 0;
  for (const attempt of attempts) {
    if (mistakes >= maxMistakes || solved.length >= board.groups.length - 1) break;
    const verdict = judge(attempt, board.groups.filter((group) => !solved.includes(group)));
    if (verdict.kind === 'correct') solved.push(verdict.group);
    else mistakes++;
  }
  // El último grupo es lo que queda: no hace falta enviarlo.
  if (solved.length === board.groups.length - 1) solved.push(...board.groups.filter((group) => !solved.includes(group)));
  const won = solved.length === board.groups.length;
  return { solved, mistakes, won, over: won || mistakes >= maxMistakes };
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** ¿Es esta selección igual a otra ya enviada? Repetirla no cuenta como error: se avisa y no se gasta nada. */
export function isRepeat(selection: readonly string[], attempts: readonly (readonly string[])[]): boolean {
  return attempts.some((attempt) => sameSet(attempt, selection));
}

/**
 * Las selecciones guardadas que siguen siendo válidas: cada una tiene que ser de
 * `GROUP_SIZE` elementos distintos de los de hoy (el dataset pudo cambiar), sin usar
 * elementos de un grupo ya resuelto ni repetir una anterior, y no hay nada después de
 * terminar. Se queda con la parte válida desde el principio.
 */
export function restoreAttempts(stored: readonly unknown[] | undefined, board: Board, maxMistakes: number): string[][] {
  const ids = new Set(board.start);
  const restored: string[][] = [];
  for (const attempt of stored ?? []) {
    if (!Array.isArray(attempt) || attempt.length !== GROUP_SIZE) break;
    if (!attempt.every((id): id is string => typeof id === 'string' && ids.has(id)) || new Set(attempt).size !== GROUP_SIZE) break;
    const progress = progressOf(restored, board, maxMistakes);
    if (progress.over) break;
    if (progress.solved.some((group) => attempt.some((id) => group.members.includes(id)))) break;
    if (isRepeat(attempt, restored)) break;
    restored.push([...attempt]);
  }
  return restored;
}

// --- Compartir -------------------------------------------------------------------

// Un cuadrado por dificultad, de la más fácil a la más difícil.
const SQUARES = ['🟨', '🟩', '🟦', '🟪'] as const;

/**
 * Grilla para compartir: una línea por selección enviada, en orden, con un cuadrado por
 * elemento del color de su grupo (ordenados del más fácil al más difícil). Solo colores:
 * no dice cuáles eran los grupos ni los elementos.
 */
export function shareGrid(attempts: readonly (readonly string[])[], board: Board): string[] {
  return attempts.map((attempt) =>
    attempt
      .map((id) => {
        const group = board.groups.find((candidate) => candidate.members.includes(id));
        return group ? DIFFICULTIES.indexOf(group.difficulty) : -1;
      })
      .sort((a, b) => a - b)
      .map((index) => SQUARES[index] ?? '⬜')
      .join(''),
  );
}

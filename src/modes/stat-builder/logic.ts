import { seedFor, type DailyContext } from '@/engine/daily';
import { mulberry32, randomInt } from '@/engine/rng';
import type { Entity } from '@/engine/types';
import type { StatBuilderConfig } from './types';

export interface Assignment { readonly key: string; readonly entityId: string }
/** Try every assignment of the drawn occurrences (including repeated entities).
 * Six slots have only 720 permutations; ties keep the player's combination. */
export function bestBuild(build: readonly Assignment[], pool: readonly Entity[]): Assignment[] {
  let best = [...build];
  let maximum = totalOf(best, pool);
  const used = new Set<number>();
  function visit(next: Assignment[]) {
    if (next.length === build.length) {
      const total = totalOf(next, pool);
      if (total > maximum) { maximum = total; best = [...next]; }
      return;
    }
    for (let index = 0; index < build.length; index++) {
      if (used.has(index)) continue;
      used.add(index);
      visit([...next, { key: build[next.length].key, entityId: build[index].entityId }]);
      used.delete(index);
    }
  }
  visit([]);
  return best;
}
export const limitFor = (base: number, level: number): number => Math.max(1, base + level - 1);
export function outcomeOf(attempts: readonly (readonly Assignment[])[], pool: readonly Entity[], target: number, limit: number) {
  const won = attempts.some((attempt) => totalOf(attempt, pool) > target);
  return { won, over: won || attempts.length >= limit };
}
/**
 * Las reglas de una partida: el total a superar y cuántas combinaciones hay. Sin versus, las de siempre. En versus:
 * `fixedAttempts` (Menos intentos) juega exactamente esa cantidad y superar el nivel no termina antes; `targetTotal`
 * (Contrarreloj y Carrera) da combinaciones ilimitadas hasta la primera que supera ese total.
 */
export function playRulesOf(
  versus: { readonly unlimited?: boolean; readonly fixedAttempts?: number; readonly targetTotal?: number } | undefined, target: number, limit: number): { readonly target: number; readonly limit: number; readonly fixed: boolean } {
  if (versus?.fixedAttempts !== undefined) return { target, limit: versus.fixedAttempts, fixed: true };
  if (versus?.targetTotal !== undefined || versus?.unlimited) return { target: versus.targetTotal ?? target, limit: Infinity, fixed: false };
  return { target, limit, fixed: false };
}

/** `outcomeOf` con las reglas de la partida: con combinaciones fijas, termina solo al hacerlas todas. */
export function playOutcome(attempts: readonly (readonly Assignment[])[], pool: readonly Entity[], rules: { readonly target: number; readonly limit: number; readonly fixed: boolean }) {
  const outcome = outcomeOf(attempts, pool, rules.target, rules.limit);
  return rules.fixed ? { won: outcome.won, over: attempts.length >= rules.limit } : outcome;
}

export function draw(pool: readonly Entity[], ctx: DailyContext, attempt: number, position: number, excluded: readonly string[] = []): Entity {
  const remaining = [...pool].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (position < 0 || position >= remaining.length) throw new RangeError('No quedan entidades para este sorteo');
  // Reconstruye los sorteos anteriores sin depender de la estadística que eligió el jugador.
  for (let index = 0; index <= position; index++) {
    // Un borrador anterior al cambio también puede contener sorteos de la secuencia vieja.
    if (index === position) {
      for (let i = remaining.length - 1; i >= 0; i--) if (excluded.includes(remaining[i].id)) remaining.splice(i, 1);
      if (remaining.length === 0) throw new RangeError('No quedan entidades para este sorteo');
    }
    const rng = mulberry32(seedFor({ ...ctx, mode: `${ctx.mode}:${attempt}:${index}` }));
    const [entity] = remaining.splice(randomInt(rng, 0, remaining.length), 1);
    if (index === position) return entity;
  }
  throw new RangeError('Posición inválida');
}
export function totalOf(assignments: readonly Assignment[], pool: readonly Entity[]): number {
  return assignments.reduce((total, assignment) => total + Number(pool.find((entity) => entity.id === assignment.entityId)?.attrs[assignment.key] ?? 0), 0);
}
export function restoreBuild(raw: unknown, pool: readonly Entity[], config: StatBuilderConfig): Assignment[] {
  if (!Array.isArray(raw)) return [];
  const keys = new Set<string>();
  const result: Assignment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || !config.stats.some((stat) => stat.key === item.key) || keys.has(item.key) || !pool.some((entity) => entity.id === item.entityId)) break;
    keys.add(item.key);
    result.push({ key: item.key, entityId: item.entityId });
  }
  return result;
}

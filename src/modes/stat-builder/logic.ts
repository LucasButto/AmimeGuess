import { seedFor, type DailyContext } from '@/engine/daily';
import { mulberry32, randomInt } from '@/engine/rng';
import type { Entity } from '@/engine/types';
import type { StatBuilderConfig } from './types';

export interface Assignment { readonly key: string; readonly entityId: string }
export const limitFor = (base: number, level: number): number => Math.max(1, base + level - 1);
export function outcomeOf(attempts: readonly (readonly Assignment[])[], pool: readonly Entity[], target: number, limit: number) {
  const won = attempts.some((attempt) => totalOf(attempt, pool) > target);
  return { won, over: won || attempts.length >= limit };
}
export function draw(pool: readonly Entity[], ctx: DailyContext, attempt: number, position: number): Entity {
  const rng = mulberry32(seedFor({ ...ctx, mode: `${ctx.mode}:${attempt}:${position}` }));
  return pool[randomInt(rng, 0, pool.length)];
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

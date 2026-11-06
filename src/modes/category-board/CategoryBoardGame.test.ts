import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { writeState } from '@/engine/storage';
import type { GameSession } from '@/components/game-shell/types';
import type { Entity } from '@/engine/types';
import type { BoardCategory } from './types';
import { ATTEMPT_LIMITS, buildRound } from './logic';
import { CategoryBoard } from './CategoryBoardGame';

vi.mock('@/components/skin/gameSlots', () => ({ SkinAttemptsMeter: ({ failed, total }: { failed: number; total: number }) => createElement('span', { 'data-failed-attempts': failed, 'data-limit': total }) }));

afterEach(() => vi.unstubAllGlobals());

it('una derrota guardada mantiene todo el medidor gastado al recargar, aunque el historial ya no sea válido', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  vi.stubGlobal('localStorage', storage);
  writeState(storage, session, { attempts: [], result: 'lost' });
  for (const [level, limit] of ATTEMPT_LIMITS.entries()) {
    const html = renderToStaticMarkup(createElement(CategoryBoard, { session, pool, categories, limit, level }));
    expect(html).toContain(`data-failed-attempts="${limit}" data-limit="${limit}"`);
  }
});
const session: GameSession = { franchise: 'test', mode: 'casillas', filterKey: 'all~d2', day: 300, active: ['s'], onFinish: vi.fn() };
const pool: Entity[] = Array.from({ length: 12 }, (_, index) => ({ id: `e${index}`, name: { es: `Personaje ${index}` }, aliases: [], series: ['s'], image: `test/e${index}`, attrs: {} }));
const categories: BoardCategory[] = [...Array.from({ length: 8 }, (_, index) => ({ id: `c${index}`, label: `Casilla ${index}`, help: 'Ayuda', members: [`e${index}`] })), { id: 'comodin', label: 'Comodín', help: 'Cualquiera', members: [], wildcard: true }];

it('la ruleta oculta el nombre futuro incluso a lectores de pantalla y presenta nueve casillas', () => {
  const html = renderToStaticMarkup(createElement(CategoryBoard, { session, pool, categories, limit: 4, level: 1 }));
  expect(html.match(/data-part="category-cell"/g)).toHaveLength(9);
  expect(html).toContain('Detener ruleta');
  expect(html).not.toContain('Ubicar a Personaje');
});

it('al restaurar una colocación mantiene al personaje y no habilita otra ruleta hasta avanzar', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  vi.stubGlobal('localStorage', storage);
  const first = buildRound(pool, categories, session, 0)[0];
  writeState(storage, session, { attempts: [], result: 'playing', draft: { phase: 'placed', placements: ['comodin'] } });
  const html = renderToStaticMarkup(createElement(CategoryBoard, { session, pool, categories, limit: 4, level: 1 }));
  expect(html).toContain(`Comodín: ${first.name.es}`);
  expect(html).toContain('Siguiente personaje');
  expect(html).toContain('data-phase="placed"');
  expect(html).not.toContain('Detener ruleta');
});

it('muestra una sola acción de nuevo intento dentro del personaje y marca la grilla fallida', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  vi.stubGlobal('localStorage', storage);
  const blockedCategories = categories.map((category) => ({ ...category, members: [] }));
  writeState(storage, session, { attempts: [{ placements: ['comodin'], outcome: 'blocked' }], result: 'playing', draft: { phase: 'failed' } });
  const html = renderToStaticMarkup(createElement(CategoryBoard, { session, pool, categories: blockedCategories, limit: 3, level: 0 }));
  expect(html).toMatch(/<section[^>]*data-part="category-spotlight"[^>]*>[\s\S]*?<button[^>]*data-variant="primary"[^>]*>[\s\S]*?Nuevo intento[\s\S]*?<\/section>/);
  expect(html.match(/Nuevo intento/g)).toHaveLength(1);
  expect(html).toContain('data-part="category-grid" data-outcome="failed"');
});

it('marca la grilla ganada aunque el comodín quede libre', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  vi.stubGlobal('localStorage', storage);
  const draws = buildRound(pool, categories, session, 0);
  const winningCategories = categories.map((category, index) => ({ ...category, members: [draws[index].id] }));
  const placements = winningCategories.filter((category) => !category.wildcard).map((category) => category.id);
  writeState(storage, session, { attempts: [{ placements, outcome: 'won' }], result: 'won' });
  const html = renderToStaticMarkup(createElement(CategoryBoard, { session, pool, categories: winningCategories, limit: 3, level: 0 }));
  expect(html).toContain('data-part="category-grid" data-outcome="won"');
  expect(html).not.toContain('Nuevo intento');
});

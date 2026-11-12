// @vitest-environment jsdom
import { createElement as h } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ModeGame } from '@/app/[franchise]/[mode]/ModeGame';
import { modeStatus } from '@/app/[franchise]/[mode]/playable';
import type { FinishReport, VersusProgress } from '@/components/game-shell/types';
import { franchises } from '@/franchises';
import { loadFranchiseData, type FranchiseData } from '@/franchises/data';
import { DEFAULT_OPTIONS, type Partida } from '@/versus/config';
import { engineRulesFor } from '@/versus/session';
import { VersusGameContext, type VersusGame } from './VersusGameContext';

// Pasos 1.4 y 1.5 en los nueve motores con datos reales: dentro de una sala, el cierre desde afuera (`stop: 'timeUp'`)
// bloquea el juego y reporta `timedOut`, y el marco le entrega a cada motor las reglas de su modalidad.

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const data: Record<string, FranchiseData | undefined> = {};
beforeAll(async () => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  Element.prototype.scrollIntoView = () => undefined;
  window.scrollTo = () => undefined;
  HTMLImageElement.prototype.decode = () => Promise.resolve();
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => undefined;
  for (const franchise of franchises) data[franchise.slug] = await loadFranchiseData(franchise.slug);
});

let root: Root | null = null;
let container: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

async function play(franchiseSlug: string, modeSlug: string, game: Partial<VersusGame>) {
  const franchise = franchises.find((candidate) => candidate.slug === franchiseSlug)!;
  const mode = franchise.modes.find((candidate) => candidate.slug === modeSlug)!;
  const modes = franchise.modes.map((candidate) => ({ slug: candidate.slug, name: candidate.name, available: true }));
  const reports: FinishReport[] = [];
  const progress: VersusProgress[] = [];
  const partida: Partida = { franchise: franchiseSlug, mode: modeSlug, engine: mode.engine, series: [...franchise.series], timeLimitMs: 60_000 };
  const value: VersusGame = { seed: 'motores', index: 1, total: 1, modality: 'timeAttack', partida, options: DEFAULT_OPTIONS, startedAt: Date.now(), endsAt: Date.now() + 60_000, onFinish: (report) => reports.push(report), onProgress: (item) => progress.push(item), ...game };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(h(VersusGameContext.Provider, { value }, h(ModeGame, { appShell: false, franchise, mode, modes, playable: true })));
  });
  // Los datos se cargan con import dinámico: se espera a que el juego esté montado.
  for (let tries = 0; tries < 100 && !container.querySelector('[data-game-ready]') && !container.querySelector('[role="status"]'); tries++) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
  }
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  return { reports, progress, container };
}

const playable = () =>
  franchises.flatMap((franchise) =>
    franchise.modes.filter((mode) => modeStatus(franchise, mode, data[franchise.slug]) === 'playable').map((mode) => ({ franchise: franchise.slug, mode: mode.slug, engine: mode.engine })),
  );

describe('los nueve motores dentro de una sala', () => {
  it('cada modo jugable se bloquea con `stop: timeUp`, muestra la respuesta y reporta `timedOut`', async () => {
    const engines = new Set<string>();
    for (const { franchise, mode, engine } of playable()) {
      const { reports, container: view } = await play(franchise, mode, { stop: 'timeUp' });
      expect(reports, `${franchise}/${mode}`).toHaveLength(1);
      expect(reports[0], `${franchise}/${mode}`).toMatchObject({ won: false, timedOut: true, fresh: true });
      expect(view.querySelector('[data-versus-summary]')?.textContent, `${franchise}/${mode}`).toContain('Se acabó el tiempo');
      // Sin intentos de más: el marco no vuelve a reportar.
      engines.add(engine);
      act(() => root!.unmount());
      view.remove();
      root = null;
      localStorage.clear();
    }
    // Todos los motores del sitio quedaron cubiertos (en datos reales y con los modos que hoy están activos).
    expect([...engines].sort()).toEqual(['category-board', 'classic', 'connections', 'higher-lower', 'image-reveal', 'reveal-list', 'stat-builder', 'text-clue', 'timeline']);
  }, 120_000);

  it('Contrarreloj y Carrera: sin límite de intentos; Menos intentos: con los de siempre', () => {
    for (const { engine } of playable()) {
      expect(engineRulesFor('timeAttack', engine, DEFAULT_OPTIONS).unlimited, engine).toBe(true);
      expect(engineRulesFor('race', engine, DEFAULT_OPTIONS).unlimited, engine).toBe(true);
      expect(engineRulesFor('fewestAttempts', engine, DEFAULT_OPTIONS).unlimited, engine).toBeUndefined();
    }
  });
});

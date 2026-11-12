// @vitest-environment jsdom
import { createElement as h } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FinishReport, VersusProgress } from '@/components/game-shell/types';
import type { Content, Entity } from '@/engine/types';
import { pokemonConfig } from '@/franchises/pokemon/config';
import { ClassicGame } from '@/modes/classic/ClassicGame';
import { DEFAULT_OPTIONS, type Partida } from '@/versus/config';
import { versusDay } from '@/versus/seed';
import { VersusGameContext, type VersusGame } from './VersusGameContext';

// Paso 1.6 de docs/versus/03-fase-1-base.md: el marco monta Pokémon Clásico con el contexto de una partida de versus
// y se comporta como dice 02-arquitectura.md ("GameShell en modo versus"). Corre en jsdom.

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const classic = pokemonConfig.modes.find((mode) => mode.slug === 'clasico')!;
let entities: Entity[];
let contents: Content[];

beforeAll(async () => {
  // jsdom no trae lo que el marco usa para desplazarse y para las preferencias del sistema.
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  Element.prototype.scrollIntoView = () => undefined;
  window.scrollTo = () => undefined;
  entities = (await import('../../../data/pokemon/entities.json')).default as Entity[];
  contents = (await import('../../../data/pokemon/content.json')).default as Content[];
});

const partida: Partida = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1', 'g2'], timeLimitMs: 90_000 };
const modes = [{ slug: 'clasico', name: 'Clásico', available: true }];
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

function mount(game: Partial<VersusGame> = {}) {
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  const value: VersusGame = { seed: 'sala-de-prueba', index: 2, total: 3, modality: 'timeAttack', partida, options: DEFAULT_OPTIONS, startedAt: Date.now(), endsAt: Date.now() + 90_000, ...game };
  root = createRoot(container);
  act(() => {
    root!.render(
      h(VersusGameContext.Provider, { value }, h(ClassicGame, { franchise: pokemonConfig, mode: { slug: classic.slug, name: classic.name }, modes, config: classic.classic!, entities, contents })),
    );
  });
  return value;
}

const keys = () => Object.keys(localStorage);

describe('GameShell con el contexto de versus', () => {
  it('juega el día de versus de la partida, con los filtros de la sala y sin tocar lo guardado', () => {
    const progress: VersusProgress[] = [];
    mount({ onProgress: (value) => progress.push(value), stop: 'timeUp', onFinish: () => undefined });
    // El cierre desde afuera guarda la partida con el día de versus y la combinación de filtros de la partida.
    const day = versusDay('sala-de-prueba', 2);
    expect(keys()).toContain(`md:v1:state:pokemon:clasico:g1.g2:${day}`);
    // Ni estadísticas, ni racha, ni filtros guardados, ni práctica.
    expect(keys().filter((key) => /stats|filters|streak/.test(key))).toEqual([]);
    expect(keys().filter((key) => key.startsWith('md:v1:state:'))).toHaveLength(1);
    expect(window.location.search).not.toContain('s=');
  });

  it('con el tiempo agotado, onFinish llega con el reporte y se ve el resumen corto', () => {
    const reports: FinishReport[] = [];
    mount({ onFinish: (report) => reports.push(report), stop: 'timeUp' });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ won: false, timedOut: true, fresh: true });
    expect(reports[0].answer.label).toBeTruthy();
    const summary = container!.querySelector('[data-versus-summary]');
    expect(summary?.textContent).toContain('Se acabó el tiempo · +1:30');
    expect(summary?.textContent).toContain(reports[0].answer.label);
  });

  it('oculta lo del modo de siempre: modo infinito, Ayer fue…, cuenta regresiva, filtros y compartir', () => {
    mount({ stop: 'timeUp' });
    const text = container!.textContent ?? '';
    expect(text).not.toMatch(/Modo infinito|Ayer fue|Próximo reto|Compartir/);
    expect(container!.querySelector('[data-versus-bar]')?.textContent).toContain('Contrarreloj');
    expect(container!.querySelector('[data-versus-bar]')?.textContent).toContain('Partida 2 de 3');
    expect(container!.querySelector('[data-versus-clock]')).not.toBeNull();
  });

  it('Carrera: sin Rendirse, y el reloj cuenta el tiempo total', () => {
    mount({ modality: 'race', partida: { ...partida, timeLimitMs: undefined }, endsAt: undefined, raceStartedAt: Date.now() - 65_000 });
    expect(container!.textContent).not.toContain('Rendirse');
    expect(container!.querySelector('[data-versus-bar]')?.textContent).toContain('Tiempo total');
    expect(container!.querySelector('[data-versus-clock]')?.textContent).toBe('1:05');
  });

  it('Contrarreloj: con Rendirse y cuenta regresiva; Menos intentos: sin reloj', () => {
    mount();
    expect(container!.textContent).toContain('Rendirse');
    expect(container!.querySelector('[data-versus-clock]')?.textContent).toBe('1:30');
    act(() => root!.unmount());
    container!.remove();
    mount({ modality: 'fewestAttempts', partida: { ...partida, timeLimitMs: undefined }, endsAt: undefined });
    expect(container!.querySelector('[data-versus-clock]')).toBeNull();
    expect(container!.querySelector('[data-versus-bar]')?.textContent).toContain('Menos intentos');
  });

  it('sin el contexto, el marco queda como siempre', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => {
      root!.render(h(ClassicGame, { franchise: pokemonConfig, mode: { slug: classic.slug, name: classic.name }, modes, config: classic.classic!, entities, contents }));
    });
    expect(container.querySelector('[data-versus-bar]')).toBeNull();
    expect(container.textContent).toContain('Próximo reto');
  });
});

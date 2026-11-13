// @vitest-environment jsdom
import { createElement as h } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FinishReport } from '@/components/game-shell/types';
import { DEFAULT_OPTIONS, type Partida } from '@/versus/config';
import type { PlayerView, ProgressView } from '@/versus/protocol';
import { VersusClock } from './VersusClock';
import type { VersusGame, VersusRoomView } from './VersusGameContext';
import { VersusSummary } from './VersusSummary';

// Sesión 31: la barra de la partida (reloj, total acumulado, rivales, avisos, salir) y el resumen que avanza solo.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const partida: Partida = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'], timeLimitMs: 60_000 };
const player = (id: string, name: string, extra: Partial<PlayerView> = {}): PlayerView => ({ id, name, ready: true, connected: true, abandoned: false, ...extra }) as PlayerView;
const progress = (playerId: string, index: number): ProgressView => ({ playerId, index, attempts: 2 }) as ProgressView;

function room(extra: Partial<VersusRoomView> = {}): VersusRoomView {
  return {
    code: 'ABCD23',
    meId: 'p1',
    players: [player('p1', 'Lucas'), player('p2', 'Beto'), player('p3', 'Caro', { connected: false }), player('p4', 'Dani', { abandoned: true })],
    progress: [progress('p1', 2), progress('p2', 1), progress('p3', 2), progress('p4', 1)],
    status: 'open',
    notices: ['Beto terminó la partida 1', 'Caro terminó la partida 1'],
    finishedMs: { 1: 20_000 },
    onLeave: () => undefined,
    ...extra,
  };
}

function game(extra: Partial<VersusGame> = {}): VersusGame {
  return { seed: 'abc', index: 2, total: 3, modality: 'timeAttack', partida, options: DEFAULT_OPTIONS, startedAt: 1_000, endsAt: 61_000, now: () => 11_000, room: room(), ...extra };
}

let root: Root | null = null;
let container: HTMLElement | null = null;

function mount(element: ReturnType<typeof h>) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(element));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

describe('barra de versus', () => {
  it('muestra el tiempo que queda con la hora del servidor y el total acumulado', () => {
    const view = mount(h(VersusClock, { game: game() }));
    expect(view.querySelector('[data-versus-clock]')?.textContent).toBe('0:50');
    // 20 s de la partida 1 + 10 s de ésta.
    expect(view.textContent).toContain('0:30');
  });

  it('lista a los rivales por partida, sin intentos, y marca a quien se desconectó o se fue', () => {
    const text = mount(h(VersusClock, { game: game() })).textContent ?? '';
    expect(text).toContain('Vos');
    expect(text).toContain('2/3');
    expect(text).toContain('Desconectado');
    expect(text).toContain('Se fue');
    expect(text).not.toContain('intento');
  });

  it('solo se ve el último aviso y Salir llama a onLeave', () => {
    const onLeave = vi.fn();
    const view = mount(h(VersusClock, { game: game({ room: room({ onLeave }) }) }));
    expect(view.textContent).toContain('Caro terminó la partida 1');
    expect(view.textContent).not.toContain('Beto terminó la partida 1');
    act(() => (view.querySelector('button') as HTMLButtonElement).click());
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('avisa cuando se perdió la conexión', () => {
    const view = mount(h(VersusClock, { game: game({ room: room({ status: 'reconnecting' }) }) }));
    expect(view.querySelector('[role="status"]')?.textContent).toContain('Sin conexión');
  });
});

describe('resumen entre partidas', () => {
  const report: FinishReport = { won: false, fresh: true, attempts: 3, timedOut: true, answer: { label: 'Pikachu' } } as FinishReport;

  it('pasa solo a la partida siguiente a los 4 s', () => {
    vi.useFakeTimers();
    const onNext = vi.fn();
    mount(h(VersusSummary, { game: game({ onNext }), report }));
    vi.advanceTimersByTime(3_900);
    expect(onNext).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('no avanza solo si la partida ya estaba terminada al cargar', () => {
    vi.useFakeTimers();
    const onNext = vi.fn();
    mount(h(VersusSummary, { game: game({ onNext }), report: { ...report, fresh: false } }));
    vi.advanceTimersByTime(10_000);
    expect(onNext).not.toHaveBeenCalled();
  });
});

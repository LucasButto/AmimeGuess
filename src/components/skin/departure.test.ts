import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeparture } from './departure';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('salidas de página sin cortinas persistentes', () => {
  it('navega al quedar cubierta y se retira a los 800 ms aunque la ruta no responda', () => {
    const departure = createDeparture();
    const navigate = vi.fn();
    departure.start('/pokemon', '/pokemon/clasico', 400, navigate);
    vi.advanceTimersByTime(399);
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/pokemon/clasico');
    expect(departure.snapshot()?.from).toBe('/pokemon');
    vi.advanceTimersByTime(400);
    expect(departure.snapshot()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('llegar al modo y volver a Pokémon no resucita la salida del inicio', () => {
    const departure = createDeparture();
    departure.start('/pokemon', '/pokemon/clasico', 400, vi.fn());
    vi.advanceTimersByTime(400);
    departure.arrive('/pokemon/clasico');
    expect(departure.snapshot()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    departure.arrive('/pokemon');
    expect(departure.snapshot()).toBeNull();
  });

  it('un temporizador anterior no interrumpe la animación del botón de volver', () => {
    const departure = createDeparture();
    const navigate = vi.fn();
    departure.start('/pokemon', '/pokemon/clasico', 400, navigate);
    vi.advanceTimersByTime(400);
    departure.arrive('/pokemon/clasico');
    departure.start('/pokemon/clasico', '/pokemon', 250, navigate);
    vi.advanceTimersByTime(400);
    expect(navigate.mock.calls).toEqual([['/pokemon/clasico'], ['/pokemon']]);
    expect(departure.snapshot()?.from).toBe('/pokemon/clasico');
    vi.advanceTimersByTime(100);
    expect(departure.snapshot()).toBeNull();
  });

  it('un doble clic no programa dos navegaciones', () => {
    const departure = createDeparture();
    const navigate = vi.fn();
    expect(departure.start('/pokemon', '/pokemon/clasico', 400, navigate)).toBe(true);
    expect(departure.start('/pokemon', '/pokemon/silueta', 400, navigate)).toBe(false);
    vi.runAllTimers();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/pokemon/clasico');
  });

  it('desmontar o esconder una página cancela el estado y la navegación pendiente', () => {
    const departure = createDeparture();
    const navigate = vi.fn();
    const listener = vi.fn();
    const unsubscribe = departure.subscribe(listener);
    departure.start('/pokemon/clasico', '/pokemon', 250, navigate);
    departure.cancel();
    vi.runAllTimers();
    expect(navigate).not.toHaveBeenCalled();
    expect(departure.snapshot()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });
});

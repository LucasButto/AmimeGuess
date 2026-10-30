import { describe, expect, it } from 'vitest';
import { attemptLimit, fitHints, restoreLimited } from './attempts';

describe('presupuesto editable de intentos', () => {
  it('con todas las opciones usa try exactamente y permite editarlo', () => {
    expect(attemptLimit(8, 1025, 1025, true)).toBe(8);
    expect(attemptLimit(10, 1025, 1025, true)).toBe(10);
  });
  it('reduce gradualmente según las respuestas elegibles, no solo el número de filtros', () => {
    expect(attemptLimit(10, 151, 1025, true)).toBe(8);
    expect(attemptLimit(10, 251, 1025, true)).toBe(8);
    expect(attemptLimit(10, 386, 1025, true)).toBe(9);
    expect(attemptLimit(10, 905, 1025, true)).toBe(10);
    expect(attemptLimit(7, 10, 1025, true)).toBe(3);
    expect(attemptLimit(1, 10, 1025, true)).toBe(1);
    expect(attemptLimit(2, 10, 1025, true)).toBe(2);
    expect(attemptLimit(1, 10, 1025, false)).toBe(1);
    expect(attemptLimit(4, 10, 1025, false)).toBe(4);
  });
  it('adelanta las ayudas que quedarían fuera y mantiene las que ya entran', () => {
    expect(fitHints([{ after: 4 }, { after: 10 }], 8)).toEqual([{ after: 3 }, { after: 7 }]);
    expect(fitHints([{ after: 3 }], 1)).toEqual([{ after: 0 }]);
    expect(fitHints([{ after: 0 }, { after: 3 }, { after: 6 }], 8)).toEqual([{ after: 0 }, { after: 3 }, { after: 6 }]);
  });
  it('acota partidas abiertas y conserva las victorias anteriores', () => {
    const ids = ['a', 'b', 'c'];
    expect(restoreLimited(ids, { attempts: ids, result: 'playing' }, 2)).toEqual(['a', 'b']);
    expect(restoreLimited(ids, { attempts: ids, result: 'won' }, 2)).toEqual(ids);
  });
});

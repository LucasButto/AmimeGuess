import { describe, expect, it } from 'vitest';
import { getDay } from '@/engine/day';
import { stateKey } from '@/engine/storage';
import { PRACTICE_FROM, clearPracticeStates, isPracticeDay, newPracticeDay, type KeyedStorage } from './practice';

function memoryStorage(keys: string[]): KeyedStorage & { keys: () => string[] } {
  const store = new Set(keys);
  return {
    get length() {
      return store.size;
    },
    key: (index) => [...store][index] ?? null,
    removeItem: (key) => void store.delete(key),
    keys: () => [...store],
  };
}

describe('días del modo infinito', () => {
  it('un día de práctica nunca se confunde con un día real', () => {
    // Un día real tiene unos cientos de días desde 2026-01-01: décadas de margen.
    const inTwentyYears = getDay(new Date('2046-01-01T12:00:00Z'));
    expect(isPracticeDay(inTwentyYears)).toBe(false);
    expect(isPracticeDay(0)).toBe(false);
    expect(isPracticeDay(PRACTICE_FROM)).toBe(true);
  });

  it('cada partida nueva es un número entero de práctica, y casi nunca se repite', () => {
    const days = new Set(Array.from({ length: 50 }, () => newPracticeDay()));
    expect(days.size).toBeGreaterThan(45);
    for (const day of days) {
      expect(Number.isInteger(day)).toBe(true);
      expect(isPracticeDay(day)).toBe(true);
    }
  });
});

describe('clearPracticeStates', () => {
  const daily = stateKey({ franchise: 'pokemon', mode: 'clasico', filterKey: 'all', day: 280 });
  const practice = stateKey({ franchise: 'pokemon', mode: 'clasico', filterKey: 'g1', day: PRACTICE_FROM + 5 });
  const other = 'md:v1:stats:pokemon:clasico';

  it('borra solo las partidas de práctica: no toca el reto del día, las estadísticas ni lo ajeno', () => {
    const storage = memoryStorage([daily, practice, other, 'otra-app:clave']);
    clearPracticeStates(storage);
    expect(storage.keys()).toEqual([daily, other, 'otra-app:clave']);
  });

  it('sin almacenamiento no hace nada', () => {
    expect(() => clearPracticeStates(null)).not.toThrow();
  });
});

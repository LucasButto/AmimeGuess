import { describe, expect, it } from 'vitest';
import { getDay } from '@/engine/day';
import { stateKey } from '@/engine/storage';
import {
  PRACTICE_FROM,
  clearPracticeStates,
  isPracticeDay,
  newPracticeDay,
  pickPracticeDay,
  practiceKeyOf,
  practiceSeenKey,
  readSeen,
  writeSeen,
  type KeyedStorage,
} from './practice';

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

describe('modo infinito sin repetir', () => {
  /** Un modo con `size` retos: el día D tiene el reto `D % size`, como si la respuesta saliera de un sorteo con semilla. */
  function pool(size: number) {
    return (day: number) => `reto-${day % size}`;
  }

  /** Juega `games` partidas seguidas con el selector, guardando lo jugado igual que `GameShell`. */
  function play(size: number, games: number, days: () => number) {
    const keyOf = pool(size);
    let seen = new Set<string>();
    const played: string[] = [];
    for (let game = 0; game < games; game++) {
      const pick = pickPracticeDay(keyOf, seen, { nextDay: days });
      played.push(pick.key ?? '');
      seen = new Set([...(pick.exhausted ? [] : seen), ...(pick.key ? [pick.key] : [])]);
    }
    return played;
  }

  /** Una secuencia de días repetible: un generador lineal congruente, para no depender de `Math.random` en los tests. */
  function sequence(seed: number): () => number {
    let state = seed;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return PRACTICE_FROM + (state % 1_000_000);
    };
  }

  it('no repite ningún reto hasta que salieron todos', () => {
    const played = play(12, 12, sequence(7));
    expect(new Set(played).size).toBe(12);
  });

  it('una vez que salieron todos empieza una vuelta nueva, y dentro de ella tampoco repite', () => {
    const played = play(10, 30, sequence(99));
    for (let round = 0; round < 3; round++) {
      expect(new Set(played.slice(round * 10, round * 10 + 10)).size).toBe(10);
    }
  });

  it('nunca repite un reto dos partidas seguidas, tampoco al pasar de una vuelta a la otra', () => {
    for (const size of [2, 3, 10]) {
      const played = play(size, size * 20, sequence(size));
      for (let index = 1; index < played.length; index++) expect(played[index]).not.toBe(played[index - 1]);
    }
  });

  it('con un solo reto posible no hay otra cosa que repetirlo', () => {
    expect(new Set(play(1, 5, sequence(2))).size).toBe(1);
  });

  it('un modo sin respuesta que se pueda nombrar sigue al azar y no marca nada como jugado', () => {
    const pick = pickPracticeDay(() => null, new Set(['reto-1']), { nextDay: () => PRACTICE_FROM + 3 });
    expect(pick).toEqual({ day: PRACTICE_FROM + 3, key: null, exhausted: false });
  });

  it('si ya salieron todos, devuelve un día con el aviso para empezar de cero, sin colgarse', () => {
    const seen = new Set(['reto-0', 'reto-1']);
    const pick = pickPracticeDay(pool(2), seen, { nextDay: sequence(3), maxTries: 50 });
    expect(pick.exhausted).toBe(true);
    expect(seen.has(pick.key ?? '')).toBe(true);
  });

  it('corta por tiempo aunque queden intentos', () => {
    let clock = 0;
    let calls = 0;
    const pick = pickPracticeDay(
      () => {
        calls++;
        return 'siempre-igual';
      },
      new Set(['siempre-igual']),
      { now: () => (clock += 100), budgetMs: 250, maxTries: 1_000_000, nextDay: sequence(1) },
    );
    expect(pick.exhausted).toBe(true);
    expect(calls).toBeLessThan(10);
  });
});

describe('huella de un reto', () => {
  it('es la misma para la misma respuesta y distinta si cambia el nombre, el detalle o la imagen', () => {
    const base = { label: 'Goku', detail: 'Kamehameha', imageStem: 'abc' };
    expect(practiceKeyOf(base)).toBe(practiceKeyOf({ ...base }));
    expect(practiceKeyOf(base)).not.toBe(practiceKeyOf({ ...base, label: 'Gohan' }));
    expect(practiceKeyOf(base)).not.toBe(practiceKeyOf({ ...base, detail: 'Masenko' }));
    expect(practiceKeyOf(base)).not.toBe(practiceKeyOf({ ...base, imageStem: 'xyz' }));
    expect(practiceKeyOf({ label: 'Goku' })).toMatch(/^[0-9a-z]+$/);
  });

  it('el mismo personaje con dos técnicas son retos distintos', () => {
    expect(practiceKeyOf({ label: 'Goku', detail: 'Kamehameha' })).not.toBe(practiceKeyOf({ label: 'Goku', detail: 'Genki Dama' }));
  });
});

describe('retos ya jugados guardados', () => {
  function textStorage(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial));
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
  }

  it('la clave es por franquicia, modo y combinación de filtros', () => {
    const key = practiceSeenKey('dragon-ball', 'tecnica', 'db+dbz');
    expect(key).toBe('md:v1:practice-seen:dragon-ball:tecnica:db+dbz');
    expect(key).not.toBe(practiceSeenKey('dragon-ball', 'tecnica', 'gt'));
  });

  it('lo que se guarda se vuelve a leer', () => {
    const storage = textStorage();
    writeSeen(storage, 'k', new Set(['a', 'b']));
    expect([...readSeen(storage, 'k')].sort()).toEqual(['a', 'b']);
  });

  it('sin almacenamiento, o con datos rotos, parte de cero y no falla', () => {
    expect(readSeen(null, 'k').size).toBe(0);
    expect(readSeen(textStorage({ k: '{no es json' }), 'k').size).toBe(0);
    expect(readSeen(textStorage({ k: '{"a":1}' }), 'k').size).toBe(0);
    expect([...readSeen(textStorage({ k: '["a",3,"b"]' }), 'k')]).toEqual(['a', 'b']);
    expect(() => writeSeen(null, 'k', new Set(['a']))).not.toThrow();
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('cuota llena');
      },
    };
    expect(() => writeSeen(broken, 'k', new Set(['a']))).not.toThrow();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DailyContext } from './daily';
import {
  STORAGE_PREFIX,
  activeStreak,
  applyResult,
  emptyStats,
  filtersKey,
  getLocalStorage,
  readFilters,
  readState,
  readStats,
  recordResult,
  stateKey,
  statsKey,
  writeFilters,
  writeState,
  writeStats,
  type Outcome,
  type StorageLike,
  type Stats,
} from './storage';

function memoryStorage() {
  const data = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
  return { storage, data };
}

/** Un almacenamiento bloqueado o lleno: toda operación lanza. */
const brokenStorage: StorageLike = {
  getItem() {
    throw new DOMException('bloqueado', 'SecurityError');
  },
  setItem() {
    throw new DOMException('lleno', 'QuotaExceededError');
  },
};

const ctx: DailyContext = { franchise: 'pokemon', mode: 'clasico', filterKey: 'g1.g2', day: 42 };
const win = (day: number, attempts = 4): Outcome => ({ day, won: true, attempts });
const loss = (day: number): Outcome => ({ day, won: false, attempts: 0 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('claves', () => {
  it('siguen el formato de la SPEC sección 6', () => {
    expect(STORAGE_PREFIX).toBe('md:v1');
    expect(filtersKey('pokemon')).toBe('md:v1:filters:pokemon');
    expect(stateKey(ctx)).toBe('md:v1:state:pokemon:clasico:g1.g2:42');
    expect(statsKey('dragon-ball', 'poder')).toBe('md:v1:stats:dragon-ball:poder');
  });

  it('la clave del estado distingue franquicia, modo, filtros y día', () => {
    const keys = new Set([
      stateKey(ctx),
      stateKey({ ...ctx, franchise: 'naruto' }),
      stateKey({ ...ctx, mode: 'silueta' }),
      stateKey({ ...ctx, filterKey: 'all' }),
      stateKey({ ...ctx, day: 43 }),
    ]);
    expect(keys.size).toBe(5);
  });
});

describe('filtros guardados', () => {
  it('ida y vuelta', () => {
    const { storage } = memoryStorage();
    expect(writeFilters(storage, 'pokemon', ['g1', 'g3'])).toBe(true);
    expect(readFilters(storage, 'pokemon')).toEqual(['g1', 'g3']);
  });

  it('cada franquicia guarda los suyos', () => {
    const { storage } = memoryStorage();
    writeFilters(storage, 'pokemon', ['g1']);
    writeFilters(storage, 'naruto', ['boruto']);
    expect(readFilters(storage, 'pokemon')).toEqual(['g1']);
    expect(readFilters(storage, 'naruto')).toEqual(['boruto']);
    expect(readFilters(storage, 'yugioh')).toBeNull();
  });

  it('si no hay nada guardado o está dañado devuelve null', () => {
    const { storage, data } = memoryStorage();
    expect(readFilters(storage, 'pokemon')).toBeNull();
    for (const damaged of ['{no es json', '"g1"', '{"a":1}', '[]', '[1,2]', '["g1",null]', 'null']) {
      data.set(filtersKey('pokemon'), damaged);
      expect(readFilters(storage, 'pokemon')).toBeNull();
    }
  });
});

describe('estado de la partida', () => {
  it('ida y vuelta', () => {
    const { storage } = memoryStorage();
    const state = { attempts: ['pikachu', 'eevee', { id: 3 }], result: 'playing' as const };
    expect(writeState(storage, ctx, state)).toBe(true);
    expect(readState(storage, ctx)).toEqual(state);
  });

  it('cada combinación de filtros y cada día guardan su propia partida', () => {
    const { storage } = memoryStorage();
    writeState(storage, ctx, { attempts: ['a'], result: 'won' });
    expect(readState(storage, { ...ctx, filterKey: 'all' })).toBeNull();
    expect(readState(storage, { ...ctx, day: 43 })).toBeNull();
    expect(readState(storage, ctx)).toEqual({ attempts: ['a'], result: 'won' });
  });

  it('un estado dañado se ignora', () => {
    const { storage, data } = memoryStorage();
    for (const damaged of ['{no es json', '[]', '{"attempts":"x","result":"won"}', '{"attempts":[],"result":"ganó"}', '{}']) {
      data.set(stateKey(ctx), damaged);
      expect(readState(storage, ctx)).toBeNull();
    }
  });
});

describe('estadísticas guardadas', () => {
  it('sin datos devuelve las de una persona nueva', () => {
    const { storage } = memoryStorage();
    expect(readStats(storage, 'pokemon', 'clasico')).toEqual(emptyStats());
  });

  it('ida y vuelta', () => {
    const { storage } = memoryStorage();
    const stats: Stats = {
      played: 5,
      won: 4,
      distribution: { '3': 1, '6': 3 },
      currentStreak: 2,
      maxStreak: 3,
      lastWonDay: 40,
    };
    expect(writeStats(storage, 'pokemon', 'clasico', stats)).toBe(true);
    expect(readStats(storage, 'pokemon', 'clasico')).toEqual(stats);
  });

  it('datos dañados o con forma incorrecta devuelven las de una persona nueva', () => {
    const { storage, data } = memoryStorage();
    const damaged = [
      '{no es json',
      '[]',
      'null',
      '{"played":1}',
      '{"played":-1,"won":0,"distribution":{},"currentStreak":0,"maxStreak":0,"lastWonDay":null}',
      '{"played":1.5,"won":0,"distribution":{},"currentStreak":0,"maxStreak":0,"lastWonDay":null}',
      '{"played":1,"won":0,"distribution":{"3":"x"},"currentStreak":0,"maxStreak":0,"lastWonDay":null}',
      '{"played":1,"won":0,"distribution":[],"currentStreak":0,"maxStreak":0,"lastWonDay":null}',
      '{"played":1,"won":0,"distribution":{},"currentStreak":0,"maxStreak":0,"lastWonDay":"ayer"}',
    ];
    for (const value of damaged) {
      data.set(statsKey('pokemon', 'clasico'), value);
      expect(readStats(storage, 'pokemon', 'clasico')).toEqual(emptyStats());
    }
  });

  it('las estadísticas de cada modo son independientes', () => {
    const { storage } = memoryStorage();
    recordResult(storage, 'pokemon', 'clasico', win(1));
    expect(readStats(storage, 'pokemon', 'silueta').played).toBe(0);
    expect(readStats(storage, 'naruto', 'clasico').played).toBe(0);
    expect(readStats(storage, 'pokemon', 'clasico').played).toBe(1);
  });
});

describe('almacenamiento no disponible', () => {
  it('leer devuelve el valor por defecto y escribir devuelve false, sin lanzar', () => {
    expect(readFilters(brokenStorage, 'pokemon')).toBeNull();
    expect(writeFilters(brokenStorage, 'pokemon', ['g1'])).toBe(false);
    expect(readState(brokenStorage, ctx)).toBeNull();
    expect(writeState(brokenStorage, ctx, { attempts: [], result: 'playing' })).toBe(false);
    expect(readStats(brokenStorage, 'pokemon', 'clasico')).toEqual(emptyStats());
    expect(writeStats(brokenStorage, 'pokemon', 'clasico', emptyStats())).toBe(false);
  });

  it('sin almacenamiento (null) pasa lo mismo', () => {
    expect(readFilters(null, 'pokemon')).toBeNull();
    expect(writeFilters(null, 'pokemon', ['g1'])).toBe(false);
    expect(readState(null, ctx)).toBeNull();
    expect(readStats(null, 'pokemon', 'clasico')).toEqual(emptyStats());
  });

  it('registrar un resultado devuelve las estadísticas nuevas aunque no se puedan guardar', () => {
    const stats = recordResult(brokenStorage, 'pokemon', 'clasico', win(10, 5));
    expect(stats.won).toBe(1);
    expect(stats.currentStreak).toBe(1);
    expect(recordResult(null, 'pokemon', 'clasico', win(10, 5)).won).toBe(1);
  });

  it('getLocalStorage devuelve null si no existe localStorage', () => {
    expect(getLocalStorage()).toBeNull();
  });

  it('getLocalStorage devuelve el almacenamiento del navegador cuando existe', () => {
    const { storage } = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    expect(getLocalStorage()).toBe(storage);
  });

  it('getLocalStorage devuelve null si acceder a localStorage lanza (cookies bloqueadas)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('bloqueado', 'SecurityError');
      },
    });
    try {
      expect(getLocalStorage()).toBeNull();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

describe('estadísticas y racha', () => {
  it('una persona nueva no tiene nada', () => {
    expect(emptyStats()).toEqual({
      played: 0,
      won: 0,
      distribution: {},
      currentStreak: 0,
      maxStreak: 0,
      lastWonDay: null,
    });
  });

  it('una victoria suma partida, victoria e intentos, y empieza la racha', () => {
    const stats = applyResult(emptyStats(), win(10, 4));
    expect(stats).toEqual({
      played: 1,
      won: 1,
      distribution: { '4': 1 },
      currentStreak: 1,
      maxStreak: 1,
      lastWonDay: 10,
    });
  });

  it('la distribución cuenta cuántas victorias hubo con cada cantidad de intentos', () => {
    let stats = emptyStats();
    for (const [day, attempts] of [[1, 3], [2, 5], [3, 3], [4, 3]] as const) {
      stats = applyResult(stats, win(day, attempts));
    }
    expect(stats.distribution).toEqual({ '3': 3, '5': 1 });
  });

  it('un día consecutivo suma a la racha', () => {
    let stats = emptyStats();
    for (const day of [10, 11, 12, 13]) stats = applyResult(stats, win(day));
    expect(stats.currentStreak).toBe(4);
    expect(stats.maxStreak).toBe(4);
    expect(stats.lastWonDay).toBe(13);
  });

  it('un salto de un día reinicia la racha y conserva la máxima', () => {
    let stats = emptyStats();
    for (const day of [10, 11, 12]) stats = applyResult(stats, win(day));
    expect(stats.currentStreak).toBe(3);

    stats = applyResult(stats, win(14)); // el 13 no se ganó
    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(3);
    expect(stats.lastWonDay).toBe(14);

    stats = applyResult(stats, win(15));
    expect(stats.currentStreak).toBe(2);
    expect(stats.maxStreak).toBe(3);
  });

  it('un salto largo también reinicia', () => {
    let stats = applyResult(emptyStats(), win(1));
    stats = applyResult(stats, win(2));
    stats = applyResult(stats, win(400));
    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(2);
  });

  it('la máxima se actualiza cuando la racha la supera', () => {
    let stats = emptyStats();
    for (const day of [1, 2]) stats = applyResult(stats, win(day));
    for (const day of [10, 11, 12]) stats = applyResult(stats, win(day));
    expect(stats.currentStreak).toBe(3);
    expect(stats.maxStreak).toBe(3);
  });

  it('ganar dos retos el mismo día (con distintos filtros) suma la racha una sola vez', () => {
    let stats = applyResult(emptyStats(), win(10));
    stats = applyResult(stats, win(11));
    stats = applyResult(stats, win(11, 7));
    expect(stats.currentStreak).toBe(2);
    expect(stats.won).toBe(3);
    expect(stats.played).toBe(3);
    expect(stats.distribution).toEqual({ '4': 2, '7': 1 });
  });

  it('una derrota suma una partida pero no toca la racha ni la distribución', () => {
    let stats = applyResult(emptyStats(), win(10, 4));
    stats = applyResult(stats, loss(11));
    expect(stats.played).toBe(2);
    expect(stats.won).toBe(1);
    expect(stats.currentStreak).toBe(1);
    expect(stats.lastWonDay).toBe(10);
    expect(stats.distribution).toEqual({ '4': 1 });
  });

  it('perder un día y ganar al siguiente no corta la racha si hubo otra victoria ese día', () => {
    let stats = applyResult(emptyStats(), win(10));
    stats = applyResult(stats, loss(11));
    stats = applyResult(stats, win(11));
    expect(stats.currentStreak).toBe(2);
  });

  it('una victoria con un día anterior a la última (reloj atrasado) no toca la racha', () => {
    let stats = applyResult(emptyStats(), win(10));
    stats = applyResult(stats, win(11));
    stats = applyResult(stats, win(5));
    expect(stats.currentStreak).toBe(2);
    expect(stats.lastWonDay).toBe(11);
    expect(stats.won).toBe(3);
  });

  it('no modifica las estadísticas originales', () => {
    const original = applyResult(emptyStats(), win(10));
    const snapshot = JSON.stringify(original);
    applyResult(original, win(11, 6));
    applyResult(original, loss(11));
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('recordResult lee, suma y guarda', () => {
    const { storage } = memoryStorage();
    recordResult(storage, 'pokemon', 'clasico', win(10));
    const stats = recordResult(storage, 'pokemon', 'clasico', win(11));
    expect(stats.currentStreak).toBe(2);
    expect(readStats(storage, 'pokemon', 'clasico')).toEqual(stats);
  });
});

describe('racha vigente', () => {
  const stats = applyResult(applyResult(emptyStats(), win(10)), win(11));

  it('se mantiene el mismo día de la última victoria y al día siguiente', () => {
    expect(activeStreak(stats, 11)).toBe(2);
    expect(activeStreak(stats, 12)).toBe(2);
  });

  it('se corta si pasó un día entero sin ganar', () => {
    expect(activeStreak(stats, 13)).toBe(0);
    expect(activeStreak(stats, 500)).toBe(0);
  });

  it('sin victorias es 0', () => {
    expect(activeStreak(emptyStats(), 0)).toBe(0);
  });
});

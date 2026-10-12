import { describe, expect, it } from 'vitest';
import { stateKey } from '@/engine/storage';
import { solvedToday, type KeyedStorage } from './progress';

function memory(entries: Record<string, string>): KeyedStorage {
  const keys = Object.keys(entries);
  return {
    get length() {
      return keys.length;
    },
    key: (index) => keys[index] ?? null,
    getItem: (key) => entries[key] ?? null,
    setItem: () => undefined,
  };
}

const state = (franchise: string, mode: string, filterKey: string, day: number, result: string) => ({
  [stateKey({ franchise, mode, filterKey, day })]: JSON.stringify({ attempts: [], result }),
});

describe('solvedToday', () => {
  const modes = ['clasico', 'silueta', 'mayor-o-menor'];

  it('cuenta los modos terminados hoy, ganados o perdidos, y no los que están a medias', () => {
    const storage = memory({
      ...state('pokemon', 'clasico', 'all', 100, 'won'),
      ...state('pokemon', 'silueta', 'all', 100, 'lost'),
      ...state('pokemon', 'mayor-o-menor', 'all', 100, 'playing'),
    });
    expect([...solvedToday(storage, 'pokemon', modes, 100)].sort()).toEqual(['clasico', 'silueta']);
  });

  it('cualquier combinación de filtros cuenta, y un modo con dos partidas terminadas cuenta una vez', () => {
    const storage = memory({
      ...state('pokemon', 'clasico', 'g1.g2', 100, 'won'),
      ...state('pokemon', 'clasico', 'all', 100, 'won'),
    });
    expect([...solvedToday(storage, 'pokemon', modes, 100)]).toEqual(['clasico']);
  });

  it('un modo con una partida a medias y otra terminada con otros filtros cuenta', () => {
    const storage = memory({
      ...state('pokemon', 'clasico', 'all', 100, 'playing'),
      ...state('pokemon', 'clasico', 'g1', 100, 'won'),
    });
    expect(solvedToday(storage, 'pokemon', modes, 100).has('clasico')).toBe(true);
  });

  it('no cuenta otro día, otra franquicia ni un modo que no está en la lista', () => {
    const storage = memory({
      ...state('pokemon', 'clasico', 'all', 99, 'won'),
      ...state('naruto', 'clasico', 'all', 100, 'won'),
      ...state('pokemon', 'moveset', 'all', 100, 'won'),
    });
    expect(solvedToday(storage, 'pokemon', modes, 100).size).toBe(0);
  });

  it('un día que termina igual que otro no se confunde (10 y 110)', () => {
    const storage = memory(state('pokemon', 'clasico', 'all', 110, 'won'));
    expect(solvedToday(storage, 'pokemon', modes, 10).size).toBe(0);
  });

  it('ignora lo dañado y no se rompe sin almacenamiento', () => {
    const broken = memory({
      [stateKey({ franchise: 'pokemon', mode: 'clasico', filterKey: 'all', day: 100 })]: '{no es json',
      [stateKey({ franchise: 'pokemon', mode: 'silueta', filterKey: 'all', day: 100 })]: '"texto"',
    });
    expect(solvedToday(broken, 'pokemon', modes, 100).size).toBe(0);
    expect(solvedToday(null, 'pokemon', modes, 100).size).toBe(0);
  });

  it('si el almacenamiento falla a mitad de la lectura, devuelve lo que alcanzó a contar', () => {
    const entries = state('pokemon', 'clasico', 'all', 100, 'won');
    const flaky: KeyedStorage = {
      length: 2,
      key: (index) => {
        if (index === 0) return Object.keys(entries)[0];
        throw new Error('bloqueado');
      },
      getItem: (key) => entries[key] ?? null,
      setItem: () => undefined,
    };
    expect([...solvedToday(flaky, 'pokemon', modes, 100)]).toEqual(['clasico']);
  });
});

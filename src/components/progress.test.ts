import { describe, expect, it } from 'vitest';
import { stateKey, statsKey } from '@/engine/storage';
import { siteTotals, solvedToday, streaksOf, winDays, wonToday, type KeyedStorage } from './progress';

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

describe('wonToday', () => {
  const modes = ['clasico', 'silueta'];
  const game = (mode: string, filterKey: string, day: number, result: string, attempts: number) => ({
    [stateKey({ franchise: 'pokemon', mode, filterKey, day })]: JSON.stringify({ attempts: Array<string>(attempts).fill('x'), result }),
  });

  it('da los intentos de cada modo ganado hoy y, con varias combinaciones de filtros, la de menos', () => {
    const storage = memory({
      ...game('clasico', 'all', 100, 'won', 7),
      ...game('clasico', 'g1', 100, 'won', 3),
      ...game('silueta', 'all', 100, 'lost', 6),
      ...game('clasico', 'g2', 99, 'won', 1),
    });
    expect([...wonToday(storage, 'pokemon', modes, 100)]).toEqual([['clasico', 3]]);
  });

  it('sin almacenamiento o con datos rotos, no hay nada', () => {
    expect(wonToday(null, 'pokemon', modes, 100).size).toBe(0);
    const broken = memory({ [stateKey({ franchise: 'pokemon', mode: 'clasico', filterKey: 'all', day: 100 })]: '{roto' });
    expect(wonToday(broken, 'pokemon', modes, 100).size).toBe(0);
  });
});

describe('winDays y streaksOf', () => {
  const won = (franchise: string, mode: string, day: number) => state(franchise, mode, 'all', day, 'won');

  it('junta los días con al menos un reto ganado, de cualquier franquicia, y no cuenta perdidos ni a medias ni práctica', () => {
    const storage = memory({
      ...won('pokemon', 'clasico', 100),
      ...won('naruto', 'clasico', 100),
      ...won('naruto', 'jutsu', 101),
      ...state('pokemon', 'silueta', 'all', 102, 'lost'),
      ...state('pokemon', 'silueta', 'all', 103, 'playing'),
      ...won('pokemon', 'clasico', 1_000_005),
    });
    expect([...winDays(storage)].sort()).toEqual([100, 101]);
  });

  it('sin almacenamiento o con datos rotos, no hay días', () => {
    expect(winDays(null).size).toBe(0);
    expect(winDays(memory({ [stateKey({ franchise: 'pokemon', mode: 'clasico', filterKey: 'all', day: 100 })]: '{roto' })).size).toBe(0);
  });

  it('la racha son días seguidos y sigue viva si lo último ganado fue hoy o ayer', () => {
    expect(streaksOf(new Set([98, 99, 100]), 100)).toEqual({ current: 3, best: 3 });
    expect(streaksOf(new Set([98, 99, 100]), 101)).toEqual({ current: 3, best: 3 });
    expect(streaksOf(new Set([98, 99, 100]), 102)).toEqual({ current: 0, best: 3 });
  });

  it('un salto corta la racha y se conserva la mejor', () => {
    expect(streaksOf(new Set([10, 11, 12, 13, 20, 21]), 21)).toEqual({ current: 2, best: 4 });
  });

  it('sin días no hay racha, y un día futuro (reloj atrasado) no suma', () => {
    expect(streaksOf(new Set(), 100)).toEqual({ current: 0, best: 0 });
    expect(streaksOf(new Set([100, 105]), 100)).toEqual({ current: 1, best: 1 });
  });
});

describe('siteTotals', () => {
  const stats = (played: number, won: number, maxStreak: number) =>
    JSON.stringify({ played, won, distribution: {}, currentStreak: 0, maxStreak, lastWonDay: null });

  it('suma partidas y victorias de los modos listados por franquicia y en total, y toma la mejor racha', () => {
    const storage = memory({
      [statsKey('pokemon', 'clasico')]: stats(10, 7, 4),
      [statsKey('pokemon', 'silueta')]: stats(5, 5, 6),
      [statsKey('naruto', 'clasico')]: stats(3, 1, 1),
      [statsKey('naruto', 'oculto')]: stats(99, 99, 99),
    });
    const totals = siteTotals(storage, [
      { slug: 'pokemon', modes: ['clasico', 'silueta'] },
      { slug: 'naruto', modes: ['clasico'] },
    ]);
    expect(totals).toEqual({
      played: 18,
      won: 13,
      bestModeStreak: 6,
      franchises: [
        { slug: 'pokemon', played: 15, won: 12 },
        { slug: 'naruto', played: 3, won: 1 },
      ],
    });
  });

  it('sin almacenamiento todo es cero', () => {
    expect(siteTotals(null, [{ slug: 'pokemon', modes: ['clasico'] }])).toEqual({ played: 0, won: 0, bestModeStreak: 0, franchises: [{ slug: 'pokemon', played: 0, won: 0 }] });
  });
});

import { describe, expect, it } from 'vitest';
import type { Partida } from '@/versus/config';
import type { Results, Snapshot } from '@/versus/protocol';
import { namesOf } from './names';
import { placesOf, pointsOf, repeatMarks, solvedCounts } from './resultsView';

const base = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'] } as const satisfies Partida;

describe('puntos de Menos intentos', () => {
  it('da N al primero y 1 al último', () => {
    expect(pointsOf([['a'], ['b'], ['c']], 3)).toEqual({ a: 3, b: 2, c: 1 });
  });

  it('reparte los puntos de los puestos que comparten los empatados', () => {
    expect(pointsOf([['a', 'b'], ['c']], 3)).toEqual({ a: 2.5, b: 2.5, c: 1 });
    expect(pointsOf([['a', 'b', 'c']], 3)).toEqual({ a: 2, b: 2, c: 2 });
  });

  it('con 4 jugadores y un empate al final', () => {
    expect(pointsOf([['a'], ['b'], ['c', 'd']], 4)).toEqual({ a: 4, b: 3, c: 1.5, d: 1.5 });
  });
});

describe('puestos de una partida', () => {
  it('los empatados comparten el puesto y el siguiente salta', () => {
    expect(placesOf([['a'], ['b', 'c'], ['d']])).toEqual({ a: 1, b: 2, c: 2, d: 4 });
  });
});

describe('repeticiones', () => {
  it('numera las seguidas iguales y deja sin marca las demás', () => {
    const other: Partida = { ...base, mode: 'silueta', engine: 'image-reveal' };
    expect(repeatMarks([base, base, base, other, base])).toEqual([{ n: 1, of: 3 }, { n: 2, of: 3 }, { n: 3, of: 3 }, null, null]);
  });
});

describe('resueltas', () => {
  it('cuenta solo las partidas de la sala, no el desempate', () => {
    const game = (playerId: string, status: 'solved' | 'failed') => ({ playerId, status });
    const results = {
      modality: 'timeAttack',
      table: [],
      players: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Beto' }],
      tiebreakWon: true,
      partidas: [
        { index: 1, tiebreak: false, partida: base, ranking: [], games: [game('a', 'solved'), game('b', 'failed')] },
        { index: 2, tiebreak: false, partida: base, ranking: [], games: [game('a', 'solved'), game('b', 'solved')] },
        { index: 11, tiebreak: true, partida: base, ranking: [], games: [game('a', 'solved')] },
      ],
    } as unknown as Results;
    expect(solvedCounts(results)).toEqual({ a: 2, b: 1 });
  });
});

describe('apodos en una frase', () => {
  const snapshot = { players: [{ id: '1', name: 'Ana' }, { id: '2', name: 'Beto' }, { id: '3', name: 'Caro' }] } as Pick<Snapshot, 'players'>;
  it('une con comas y una y', () => {
    expect(namesOf(snapshot, ['1'])).toBe('Ana');
    expect(namesOf(snapshot, ['1', '2'])).toBe('Ana y Beto');
    expect(namesOf(snapshot, ['1', '2', '3'])).toBe('Ana, Beto y Caro');
  });
});

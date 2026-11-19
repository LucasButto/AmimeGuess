import { describe, expect, it } from 'vitest';
import type { Partida } from './config';
import {
  applyTiebreak,
  countedTime,
  finalTable,
  halvesToPoints,
  higherLowerEarlyEnd,
  positionPoints,
  rankPartida,
  statsScore,
  tiebreakOutcome,
  tiedForFirst,
  type PartidaResult,
  type PlayedPartida,
  type Ranking,
  type RuleOptions,
  type TableRow,
  type VersusPlayer,
} from './rules';

// Cada ejemplo de docs/versus/01-reglas.md es un test (el nombre dice la sección). Los tiempos van en ms.

const s = (seconds: number) => seconds * 1000;
const min = (minutes: number, seconds = 0) => s(minutes * 60 + seconds);
const best: RuleOptions = { statsAggregation: 'best' };
const players = (...ids: string[]): VersusPlayer[] => ids.map((id) => ({ id }));
const solved = (playerId: string, more: Omit<PartidaResult, 'playerId' | 'status'> = {}): PartidaResult => ({ playerId, status: 'solved', ...more });
const points = (ranking: Ranking) => Object.fromEntries([...positionPoints(ranking)].map(([id, halves]) => [id, halvesToPoints(halves)]));
const summary = (table: readonly TableRow[]) => table.map((row) => [row.playerId, row.place, row.totalMs ?? row.arrivalMs ?? (row.halfPoints === undefined ? null : row.halfPoints / 2)]);

const pokemonClasico: Partida = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'] };
const yugiohCarta: Partida = { franchise: 'yugioh', mode: 'carta', engine: 'classic', series: ['dm'] };
const narutoSilueta: Partida = { franchise: 'naruto', mode: 'silueta', engine: 'image-reveal', series: ['naruto'] };

describe('3. Contrarreloj', () => {
  it('3 partidas de 1:00: Ana 2:15, Beto 2:05; gana Beto', () => {
    const partidas: PlayedPartida[] = [
      { engine: 'classic', timeLimitMs: min(1), results: [solved('Ana', { elapsedMs: s(30) }), solved('Beto', { elapsedMs: s(50) })] },
      { engine: 'classic', timeLimitMs: min(1), results: [solved('Ana', { elapsedMs: s(45) }), solved('Beto', { elapsedMs: s(20) })] },
      { engine: 'classic', timeLimitMs: min(1), results: [{ playerId: 'Ana', status: 'timeUp' }, solved('Beto', { elapsedMs: s(55) })] },
    ];
    expect(summary(finalTable('timeAttack', players('Ana', 'Beto'), partidas, best))).toEqual([
      ['Beto', 1, min(2, 5)],
      ['Ana', 2, min(2, 15)],
    ]);
  });

  it('tiempos distintos: Clásico de 1:30 y Estadísticas de 3:00; Ana 4:10, Beto 3:50; gana Beto', () => {
    const partidas: PlayedPartida[] = [
      { engine: 'classic', timeLimitMs: min(1, 30), results: [solved('Ana', { elapsedMs: min(1, 10) }), { playerId: 'Beto', status: 'timeUp' }] },
      { engine: 'stat-builder', timeLimitMs: min(3), results: [{ playerId: 'Ana', status: 'timeUp' }, solved('Beto', { elapsedMs: min(2, 20) })] },
    ];
    expect(summary(finalTable('timeAttack', players('Ana', 'Beto'), partidas, best))).toEqual([
      ['Beto', 1, min(3, 50)],
      ['Ana', 2, min(4, 10)],
    ]);
  });

  it('6. tiempo agotado, rendición y abandono suman el límite completo', () => {
    expect(countedTime(solved('Ana', { elapsedMs: s(42) }), min(1))).toBe(s(42));
    expect(countedTime({ playerId: 'Ana', status: 'timeUp', elapsedMs: s(61) }, min(1))).toBe(min(1));
    expect(countedTime({ playerId: 'Ana', status: 'surrendered', elapsedMs: s(5) }, min(1))).toBe(min(1));
    expect(countedTime({ playerId: 'Ana', status: 'abandoned' }, min(1))).toBe(min(1));
    expect(countedTime(undefined, min(1))).toBe(min(1));
    // Un final que el servidor midió pasado el límite nunca cuenta más que el límite.
    expect(countedTime(solved('Ana', { elapsedMs: s(70) }), min(1))).toBe(min(1));
  });

  it('8. abandono: lo que falta, incluida la actual, suma su límite completo', () => {
    const partidas: PlayedPartida[] = [
      { engine: 'classic', timeLimitMs: min(1), results: [solved('Ana', { elapsedMs: s(30) }), solved('Beto', { elapsedMs: s(40) }), solved('Caro', { elapsedMs: s(10) })] },
      { engine: 'image-reveal', timeLimitMs: min(2), results: [solved('Ana', { elapsedMs: s(30) }), solved('Beto', { elapsedMs: s(40) })] },
      { engine: 'image-reveal', timeLimitMs: min(1), results: [solved('Ana', { elapsedMs: s(30) }), solved('Beto', { elapsedMs: s(40) })] },
    ];
    const table = finalTable('timeAttack', [{ id: 'Ana' }, { id: 'Beto' }, { id: 'Caro', abandoned: true }], partidas, best);
    expect(summary(table)).toEqual([
      ['Ana', 1, s(90)],
      ['Beto', 2, s(120)],
      ['Caro', 3, s(10) + min(2) + min(1)],
    ]);
  });
});

describe('4. Carrera', () => {
  it('Ana llega a los 4:10, Beto a los 3:50 y Caro abandona en la segunda: Beto, Ana, Caro', () => {
    const partidas: PlayedPartida[] = [
      { engine: 'classic', results: [solved('Ana', { finishedAtMs: min(1) }), solved('Beto', { finishedAtMs: min(1, 20) }), solved('Caro', { finishedAtMs: min(2) })] },
      { engine: 'classic', results: [solved('Ana', { finishedAtMs: min(3) }), solved('Beto', { finishedAtMs: min(2, 30) }), { playerId: 'Caro', status: 'abandoned' }] },
      { engine: 'classic', results: [solved('Ana', { finishedAtMs: min(4, 10) }), solved('Beto', { finishedAtMs: min(3, 50) })] },
    ];
    expect(summary(finalTable('race', [{ id: 'Ana' }, { id: 'Beto' }, { id: 'Caro', abandoned: true }], partidas, best))).toEqual([
      ['Beto', 1, min(3, 50)],
      ['Ana', 2, min(4, 10)],
      ['Caro', 3, null],
    ]);
  });

  it('una sola partida: gana el primero en llegar', () => {
    const partidas: PlayedPartida[] = [{ engine: 'timeline', results: [solved('Ana', { finishedAtMs: s(75) }), solved('Beto', { finishedAtMs: s(74) })] }];
    expect(summary(finalTable('race', players('Ana', 'Beto'), partidas, best))).toEqual([
      ['Beto', 1, s(74)],
      ['Ana', 2, s(75)],
    ]);
  });

  it('el orden de una partida es por lo que tardó en ella', () => {
    const partida: PlayedPartida = { engine: 'classic', results: [solved('Ana', { elapsedMs: s(80) }), solved('Beto', { elapsedMs: s(60) }), { playerId: 'Caro', status: 'abandoned' }] };
    expect(rankPartida('race', partida, ['Ana', 'Beto', 'Caro'], best)).toEqual([['Beto'], ['Ana'], ['Caro']]);
  });
});

describe('5.1 Menos intentos: quién gana cada partida', () => {
  it('Pokémon Clásico: Ana y Beto en 4, Caro en 6, Dani pierde', () => {
    const partida: PlayedPartida = {
      engine: 'classic',
      results: [solved('Ana', { attempts: 4 }), solved('Beto', { attempts: 4 }), solved('Caro', { attempts: 6 }), { playerId: 'Dani', status: 'failed', attempts: 10 }],
    };
    const ranking = rankPartida('fewestAttempts', partida, ['Ana', 'Beto', 'Caro', 'Dani'], best);
    expect(ranking).toEqual([['Ana', 'Beto'], ['Caro'], ['Dani']]);
    expect(points(ranking)).toEqual({ Ana: 3.5, Beto: 3.5, Caro: 2, Dani: 1 });
  });

  it('el tiempo no desempata', () => {
    const partida: PlayedPartida = { engine: 'classic', results: [solved('Ana', { attempts: 4, elapsedMs: s(10) }), solved('Beto', { attempts: 4, elapsedMs: s(90) })] };
    expect(rankPartida('fewestAttempts', partida, ['Ana', 'Beto'], best)).toEqual([['Ana', 'Beto']]);
  });

  it('6. rendirse cuenta como perdida', () => {
    const partida: PlayedPartida = { engine: 'connections', results: [solved('Ana', { attempts: 4 }), { playerId: 'Beto', status: 'surrendered', attempts: 1 }] };
    expect(rankPartida('fewestAttempts', partida, ['Ana', 'Beto'], best)).toEqual([['Ana'], ['Beto']]);
  });

  it('Mayor o Menor (fallos perdonados = 3): Ana termina con 12; Beto sigue con 11 y al llegar a 13 termina solo', () => {
    const ana = { playerId: 'Ana', finished: true, score: 12 };
    expect(higherLowerEarlyEnd([ana, { playerId: 'Beto', finished: false, score: 11 }], 'Beto')).toBe(false);
    expect(higherLowerEarlyEnd([ana, { playerId: 'Beto', finished: false, score: 12 }], 'Beto')).toBe(false);
    expect(higherLowerEarlyEnd([ana, { playerId: 'Beto', finished: false, score: 13 }], 'Beto')).toBe(true);
    const partida: PlayedPartida = { engine: 'higher-lower', results: [{ playerId: 'Ana', status: 'failed', score: 12 }, solved('Beto', { score: 13 })] };
    expect(rankPartida('fewestAttempts', partida, ['Ana', 'Beto'], best)).toEqual([['Beto'], ['Ana']]);
  });

  it('Mayor o Menor: no termina antes si alguien sigue jugando', () => {
    const live = [
      { playerId: 'Ana', finished: true, score: 3 },
      { playerId: 'Beto', finished: false, score: 20 },
      { playerId: 'Caro', finished: false, score: 5 },
    ];
    expect(higherLowerEarlyEnd(live, 'Beto')).toBe(false);
  });

  it('Mayor o Menor: con los mismos aciertos empatan y agotar los fallos no es derrota', () => {
    const partida: PlayedPartida = { engine: 'higher-lower', results: [{ playerId: 'Ana', status: 'failed', score: 7 }, { playerId: 'Beto', status: 'failed', score: 7 }, { playerId: 'Caro', status: 'surrendered', score: 30 }] };
    expect(rankPartida('fewestAttempts', partida, ['Ana', 'Beto', 'Caro'], best)).toEqual([['Ana', 'Beto'], ['Caro']]);
  });

  it('Estadísticas (La suma): Ana 1.520 contra Beto 1.510, gana Ana; con La mejor, Beto (600 contra 530)', () => {
    const partida: PlayedPartida = { engine: 'stat-builder', results: [solved('Ana', { scores: [480, 530, 510] }), solved('Beto', { scores: [600, 440, 470] })] };
    expect(statsScore([480, 530, 510], 'sum')).toEqual({ value: 1520, rank: 1520 });
    expect(rankPartida('fewestAttempts', partida, ['Ana', 'Beto'], { statsAggregation: 'sum' })).toEqual([['Ana'], ['Beto']]);
    expect(rankPartida('fewestAttempts', partida, ['Ana', 'Beto'], { statsAggregation: 'best' })).toEqual([['Beto'], ['Ana']]);
  });

  it('Estadísticas (El promedio): se muestra con un decimal y se ordena por la suma', () => {
    expect(statsScore([480, 530, 510], 'average')).toEqual({ value: 506.7, rank: 1520 });
    expect(statsScore([600, 440, 470], 'best')).toEqual({ value: 600, rank: 600 });
  });
});

describe('5.2 Puntos por posición', () => {
  const table: [string, Ranking, Record<string, number>][] = [
    ['Sin empates', [['Ana'], ['Beto'], ['Caro'], ['Dani']], { Ana: 4, Beto: 3, Caro: 2, Dani: 1 }],
    ['Beto y Caro empatan 2.º', [['Ana'], ['Beto', 'Caro'], ['Dani']], { Ana: 4, Beto: 2.5, Caro: 2.5, Dani: 1 }],
    ['Caro y Dani pierden', [['Ana'], ['Beto'], ['Caro', 'Dani']], { Ana: 4, Beto: 3, Caro: 1.5, Dani: 1.5 }],
    ['Ana y Beto empatan 1.º, Caro y Dani pierden', [['Ana', 'Beto'], ['Caro', 'Dani']], { Ana: 3.5, Beto: 3.5, Caro: 1.5, Dani: 1.5 }],
    ['Empatan los cuatro', [['Ana', 'Beto', 'Caro', 'Dani']], { Ana: 2.5, Beto: 2.5, Caro: 2.5, Dani: 2.5 }],
  ];
  for (const [name, ranking, expected] of table) {
    it(`4 jugadores, ${name}: total 10`, () => {
      const got = points(ranking);
      expect(got).toEqual(expected);
      expect(Object.values(got).reduce((a, b) => a + b, 0)).toBe(10);
    });
  }

  it('3 jugadores, 2 partidas: Ana 5, Caro 4,5, Beto 2,5', () => {
    const partidas: PlayedPartida[] = [
      { engine: 'classic', results: [solved('Ana', { attempts: 2 }), solved('Beto', { attempts: 5 }), solved('Caro', { attempts: 5 })] },
      { engine: 'classic', results: [solved('Ana', { attempts: 3 }), solved('Beto', { attempts: 4 }), solved('Caro', { attempts: 1 })] },
    ];
    expect(summary(finalTable('fewestAttempts', players('Ana', 'Beto', 'Caro'), partidas, best))).toEqual([
      ['Ana', 1, 5],
      ['Caro', 2, 4.5],
      ['Beto', 3, 2.5],
    ]);
  });

  it('2 jugadores: ganar da 2, perder 1 y empatar 1,5', () => {
    expect(points([['Ana'], ['Beto']])).toEqual({ Ana: 2, Beto: 1 });
    expect(points([['Ana', 'Beto']])).toEqual({ Ana: 1.5, Beto: 1.5 });
  });

  it('todos pierden una partida: cada uno recibe (N + 1) / 2', () => {
    const partida: PlayedPartida = { engine: 'classic', results: ['Ana', 'Beto', 'Caro'].map((id) => ({ playerId: id, status: 'failed' as const, attempts: 10 })) };
    expect(points(rankPartida('fewestAttempts', partida, ['Ana', 'Beto', 'Caro'], best))).toEqual({ Ana: 2, Beto: 2, Caro: 2 });
  });

  it('con 2 a 10 jugadores y empates al azar, cada partida reparte N × (N + 1) / 2 y cada valor es entero o ,5', () => {
    let state = 12345;
    const next = () => (state = (Math.imul(state, 1103515245) + 12345) >>> 0) / 2 ** 32;
    for (let n = 2; n <= 10; n++) {
      for (let round = 0; round < 200; round++) {
        const ids = Array.from({ length: n }, (_, index) => `p${index}`);
        const ranking: string[][] = [];
        for (const id of ids) {
          if (ranking.length > 0 && next() < 0.4) ranking[ranking.length - 1].push(id);
          else ranking.push([id]);
        }
        const halves = [...positionPoints(ranking).values()];
        expect(halves).toHaveLength(n);
        for (const value of halves) expect(Number.isInteger(value)).toBe(true);
        expect(halves.reduce((a, b) => a + b, 0)).toBe(n * (n + 1));
      }
    }
  });

  it('8. abandono: lo que falta cuenta como perdido y se reparte con los que perdieron', () => {
    const partidas: PlayedPartida[] = [
      { engine: 'classic', results: [solved('Ana', { attempts: 3 }), { playerId: 'Beto', status: 'failed', attempts: 8 }] },
    ];
    const ranking = rankPartida('fewestAttempts', partidas[0], ['Ana', 'Beto', 'Caro'], best);
    expect(ranking).toEqual([['Ana'], ['Beto', 'Caro']]);
    expect(points(ranking)).toEqual({ Ana: 3, Beto: 1.5, Caro: 1.5 });
  });
});

describe('7. Desempate', () => {
  it('Menos intentos, 2 jugadores, 2 partidas: empate 3 a 3, ruleta mitad y mitad, sale Naruto Silueta y gana Ana', () => {
    const partidas: PlayedPartida[] = [
      { engine: 'classic', results: [solved('Ana', { attempts: 3 }), solved('Beto', { attempts: 6 })] },
      { engine: 'classic', results: [solved('Ana', { attempts: 7 }), solved('Beto', { attempts: 2 })] },
    ];
    const table = finalTable('fewestAttempts', players('Ana', 'Beto'), partidas, best);
    expect(summary(table)).toEqual([
      ['Ana', 1, 3],
      ['Beto', 1, 3],
    ]);
    expect(tiedForFirst(table)).toEqual(['Ana', 'Beto']);

    const played = [{ index: 1, partida: pokemonClasico }, { index: 2, partida: { ...pokemonClasico, series: ['g2'] } }];
    const outcome = tiebreakOutcome([{ played: 1 }, { other: narutoSilueta }], played, 0.75);
    expect(outcome.slices.map((slice) => slice.votes)).toEqual([1, 1]);
    expect(outcome.slices[outcome.winner].option).toEqual({ other: narutoSilueta });
    expect(outcome.partida).toEqual(narutoSilueta);

    const tiebreak = rankPartida('fewestAttempts', { engine: 'image-reveal', results: [solved('Ana', { attempts: 3 }), solved('Beto', { attempts: 5 })] }, ['Ana', 'Beto'], best);
    const after = applyTiebreak(table, tiebreak);
    expect(after.map((row) => [row.playerId, row.place])).toEqual([
      ['Ana', 1],
      ['Beto', 2],
    ]);
    expect(tiedForFirst(after)).toEqual([]);
  });

  it('3 empatados: dos votan Pokémon Clásico y uno Yu-Gi-Oh Carta; Clásico 2/3 y Carta 1/3', () => {
    const played = [{ index: 1, partida: pokemonClasico }, { index: 2, partida: yugiohCarta }];
    const votes = [{ played: 1 }, { played: 2 }, { played: 1 }];
    const low = tiebreakOutcome(votes, played, 0);
    expect(low.slices).toEqual([
      { option: { played: 1 }, votes: 2 },
      { option: { played: 2 }, votes: 1 },
    ]);
    expect(low.partida).toEqual(pokemonClasico);
    expect(tiebreakOutcome(votes, played, 0.66).partida).toEqual(pokemonClasico);
    expect(tiebreakOutcome(votes, played, 0.67).partida).toEqual(yugiohCarta);
    expect(tiebreakOutcome(votes, played, 0.999).partida).toEqual(yugiohCarta);
  });

  it('todos votan lo mismo: esa opción, sin sorteo', () => {
    const outcome = tiebreakOutcome([{ other: narutoSilueta }, { other: narutoSilueta }], [{ index: 1, partida: pokemonClasico }], 0.9);
    expect(outcome.slices).toEqual([{ option: { other: narutoSilueta }, votes: 2 }]);
    expect(outcome.partida).toEqual(narutoSilueta);
  });

  it('nadie vota: ruleta con los modos jugados, una porción cada uno (una partida ×3 es un solo modo)', () => {
    const played = [
      { index: 1, partida: { ...pokemonClasico, timeLimitMs: 90_000 } },
      { index: 2, partida: { ...pokemonClasico, timeLimitMs: 90_000 } },
      { index: 3, partida: { ...pokemonClasico, timeLimitMs: 90_000 } },
      { index: 4, partida: { ...narutoSilueta, timeLimitMs: 60_000 } },
    ];
    const outcome = tiebreakOutcome([], played, 0.6);
    expect(outcome.slices).toEqual([
      { option: { played: 1 }, votes: 1 },
      { option: { played: 4 }, votes: 1 },
    ]);
    // El desempate usa el tiempo por defecto de su tipo de modo: la partida sale sin tiempo límite.
    expect(outcome.partida).toEqual(narutoSilueta);
  });

  it('un voto por una repetición o por "otro modo" igual a uno jugado cuenta como ese modo', () => {
    const played = [{ index: 1, partida: pokemonClasico }, { index: 2, partida: pokemonClasico }, { index: 3, partida: narutoSilueta }];
    const outcome = tiebreakOutcome([{ played: 2 }, { other: pokemonClasico }, { played: 3 }], played, 0);
    expect(outcome.slices).toEqual([
      { option: { played: 1 }, votes: 2 },
      { option: { played: 3 }, votes: 1 },
    ]);
  });

  it('el empate en el segundo puesto no desempata', () => {
    const table = finalTable('fewestAttempts', players('Ana', 'Beto', 'Caro'), [{ engine: 'classic', results: [solved('Ana', { attempts: 2 }), solved('Beto', { attempts: 5 }), solved('Caro', { attempts: 5 })] }], best);
    expect(table.map((row) => [row.playerId, row.place])).toEqual([
      ['Ana', 1],
      ['Beto', 2],
      ['Caro', 2],
    ]);
    expect(tiedForFirst(table)).toEqual([]);
  });

  it('Contrarreloj: todos se quedan sin tiempo en todas las partidas, empatan y van a desempate', () => {
    const partidas: PlayedPartida[] = [1, 2].map(() => ({ engine: 'classic', timeLimitMs: min(1, 30), results: ['Ana', 'Beto', 'Caro'].map((id) => ({ playerId: id, status: 'timeUp' as const })) }));
    const table = finalTable('timeAttack', players('Ana', 'Beto', 'Caro'), partidas, best);
    expect(tiedForFirst(table)).toEqual(['Ana', 'Beto', 'Caro']);
    expect(table.every((row) => row.totalMs === min(3))).toBe(true);
    // El desempate (con su propio tiempo) lo gana Caro; Ana y Beto vuelven a quedarse sin tiempo y comparten el 2.º.
    const tiebreak = rankPartida('timeAttack', { engine: 'image-reveal', timeLimitMs: min(1), results: [solved('Caro', { elapsedMs: s(20) }), { playerId: 'Ana', status: 'timeUp' }, { playerId: 'Beto', status: 'timeUp' }] }, ['Ana', 'Beto', 'Caro'], best);
    expect(applyTiebreak(table, tiebreak).map((row) => [row.playerId, row.place])).toEqual([
      ['Caro', 1],
      ['Ana', 2],
      ['Beto', 2],
    ]);
  });

  it('el desempate vuelve a empatar: siguen 1.º y se vota otra vez entre ellos', () => {
    const table: TableRow[] = [
      { playerId: 'Ana', place: 1, halfPoints: 8 },
      { playerId: 'Beto', place: 1, halfPoints: 8 },
      { playerId: 'Caro', place: 1, halfPoints: 8 },
      { playerId: 'Dani', place: 4, halfPoints: 6 },
    ];
    const first = applyTiebreak(table, [['Beto', 'Caro'], ['Ana']]);
    expect(first.map((row) => [row.playerId, row.place])).toEqual([
      ['Beto', 1],
      ['Caro', 1],
      ['Ana', 3],
      ['Dani', 4],
    ]);
    expect(tiedForFirst(first)).toEqual(['Beto', 'Caro']);
    const second = applyTiebreak(first, [['Caro'], ['Beto']]);
    expect(second.map((row) => [row.playerId, row.place])).toEqual([
      ['Caro', 1],
      ['Beto', 2],
      ['Ana', 3],
      ['Dani', 4],
    ]);
  });

  it('8. en el desempate, quien abandona lo pierde', () => {
    const table: TableRow[] = [
      { playerId: 'Ana', place: 1, totalMs: 1000 },
      { playerId: 'Beto', place: 1, totalMs: 1000 },
    ];
    expect(applyTiebreak(table, [['Ana']]).map((row) => [row.playerId, row.place])).toEqual([
      ['Ana', 1],
      ['Beto', 2],
    ]);
  });
});

describe('8. Un solo jugador activo', () => {
  it('si los demás abandonaron, gana el que queda (en las tres modalidades)', () => {
    const roster: VersusPlayer[] = [{ id: 'Ana', abandoned: true }, { id: 'Beto' }, { id: 'Caro', abandoned: true }];
    const partidas: PlayedPartida[] = [
      { engine: 'classic', timeLimitMs: min(1), results: [solved('Ana', { elapsedMs: s(5), attempts: 1, finishedAtMs: s(5) }), solved('Caro', { elapsedMs: s(6), attempts: 1, finishedAtMs: s(6) })] },
    ];
    for (const modality of ['timeAttack', 'race', 'fewestAttempts'] as const) {
      const table = finalTable(modality, roster, modality === 'timeAttack' ? partidas : partidas.map((partida) => ({ ...partida, timeLimitMs: undefined })), best);
      expect(table[0], modality).toMatchObject({ playerId: 'Beto', place: 1 });
      expect(tiedForFirst(table), modality).toEqual([]);
    }
  });
});

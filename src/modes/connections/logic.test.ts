import { describe, expect, it } from 'vitest';
import type { DailyContext } from '@/engine/daily';
import type { Content, Entity } from '@/engine/types';
import {
  buildBoard,
  groupsOf,
  hasSolvedRow,
  isRepeat,
  judge,
  mistakesOf,
  poolOf,
  progressOf,
  restoreAttempts,
  shareGrid,
  type Board,
} from './logic';
import { DEFAULT_MISTAKES, DIFFICULTIES, GROUP_SIZE, type ConnectionsConfig } from './types';

const config: ConnectionsConfig = { contentKind: 'group', nameField: 'name', membersField: 'members', difficultyField: 'difficulty' };
const ctx: DailyContext = { franchise: 'f', mode: 'conexiones', filterKey: 'all', day: 100 };

const entity = (id: string, series: string[] = ['s1']): Entity => ({ id, name: { es: id }, aliases: [], series, attrs: {} });
const group = (id: string, difficulty: number, members: string[], series = 's1', extra: Record<string, unknown> = {}): Content => ({
  id,
  kind: 'group',
  series,
  payload: { name: `Grupo ${id}`, difficulty, members, ...extra },
  verified: false,
});
const ids = (prefix: string, count: number): string[] => Array.from({ length: count }, (_, index) => `${prefix}${String(index).padStart(2, '0')}`);

// Un universo de 40 personajes y 12 grupos (3 por dificultad) que se pisan entre sí a propósito.
const people = ids('p', 40).map((id) => entity(id));
const groups: Content[] = [
  group('a1', 1, ids('p', 10).slice(0, 9)), // p00..p08
  group('a2', 1, ['p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11']),
  group('a3', 1, ['p12', 'p13', 'p14', 'p15', 'p16', 'p17']),
  group('b1', 2, ['p00', 'p01', 'p18', 'p19', 'p20', 'p21', 'p22', 'p23']),
  group('b2', 2, ['p09', 'p10', 'p24', 'p25', 'p26', 'p27', 'p28']),
  group('b3', 2, ['p29', 'p30', 'p31', 'p32', 'p33']),
  group('c1', 3, ['p02', 'p03', 'p18', 'p19', 'p34', 'p35', 'p36', 'p37']),
  group('c2', 3, ['p14', 'p15', 'p24', 'p25', 'p38', 'p39', 'p29', 'p30']),
  group('c3', 3, ['p04', 'p12', 'p13', 'p26', 'p27', 'p31', 'p32', 'p33']),
  group('d1', 4, ['p00', 'p05', 'p09', 'p12', 'p18', 'p24', 'p29', 'p34', 'p38']),
  group('d2', 4, ['p01', 'p06', 'p10', 'p13', 'p19', 'p25', 'p30', 'p35', 'p39']),
  group('d3', 4, ['p07', 'p11', 'p16', 'p20', 'p21', 'p22', 'p23', 'p28']),
];

const allSeries = ['s1', 's2'];

describe('mistakesOf', () => {
  it('usa los errores de la configuración o, si no, 4', () => {
    expect(mistakesOf(config)).toBe(DEFAULT_MISTAKES);
    expect(mistakesOf({ ...config, mistakes: 6 })).toBe(6);
  });
});

describe('groupsOf', () => {
  it('devuelve los grupos del tipo de la configuración, ordenados por id, con sus miembros disponibles ordenados', () => {
    const found = groupsOf(people, [...groups].reverse(), allSeries, config);
    expect(found.map((item) => item.id)).toEqual(groups.map((item) => item.id).sort());
    const first = found.find((item) => item.id === 'a1');
    expect(first?.available).toEqual(ids('p', 9));
    expect(first?.members.has('p08')).toBe(true);
    expect(first?.difficulty).toBe(1);
    expect(first?.name).toBe('Grupo a1');
  });

  it('un contenido de otro tipo no es un grupo', () => {
    const other: Content = { ...group('x', 1, ids('p', 6)), kind: 'quote' };
    expect(groupsOf(people, [other], allSeries, config)).toEqual([]);
  });

  it('regla 2: un grupo de una serie apagada no es elegible', () => {
    const contents = [group('a1', 1, ids('p', 6), 's1'), group('a2', 1, ids('p', 6), 's2')];
    const both = people.map((item) => ({ ...item, series: ['s1', 's2'] }));
    expect(groupsOf(both, contents, ['s1'], config).map((item) => item.id)).toEqual(['a1']);
    expect(groupsOf(both, contents, ['s2'], config).map((item) => item.id)).toEqual(['a2']);
  });

  it('regla 1: solo cuentan como disponibles las entidades elegibles; los demás siguen siendo miembros', () => {
    const mixed = [...ids('p', 8).map((id) => entity(id, ['s2'])), ...ids('q', 5).map((id) => entity(id, ['s1']))];
    const content = group('g', 1, [...ids('p', 8), ...ids('q', 5)]);
    const [only] = groupsOf(mixed, [content], ['s1'], config);
    expect(only.available).toEqual(ids('q', 5));
    expect(only.members.size).toBe(13);
    // Con menos de 4 disponibles no es un grupo usable.
    expect(groupsOf(mixed.slice(0, 11), [content], ['s1'], config)).toEqual([]);
  });

  it('descarta los grupos con menos de 4 disponibles, sin nombre, con dificultad inválida o sin lista de miembros', () => {
    const bad = [
      group('corto', 1, ids('p', 3)),
      group('sin-nombre', 1, ids('p', 6), 's1', { name: '' }),
      group('dificultad-cero', 0, ids('p', 6)),
      group('dificultad-cinco', 5, ids('p', 6)),
      group('dificultad-texto', 1, ids('p', 6), 's1', { difficulty: '1' }),
      group('sin-miembros', 1, ids('p', 6), 's1', { members: 'p00' }),
      group('desconocidos', 1, ['zz1', 'zz2', 'zz3', 'zz4', 'zz5']),
      group('bien', 1, ids('p', 4)),
    ];
    expect(groupsOf(people, bad, allSeries, config).map((item) => item.id)).toEqual(['bien']);
  });

  it('un miembro repetido en la lista cuenta una sola vez', () => {
    const [only] = groupsOf(people, [group('g', 1, ['p00', 'p00', 'p01', 'p02', 'p03'])], allSeries, config);
    expect(only.available).toEqual(['p00', 'p01', 'p02', 'p03']);
  });
});

describe('poolOf', () => {
  it('son los grupos que forman parte de algún tablero posible', () => {
    const pool = poolOf(people, groups, allSeries, config);
    expect(pool.length).toBeGreaterThanOrEqual(4);
    expect(pool.every((item) => groups.some((content) => content.id === item.id))).toBe(true);
    expect(pool.map((item) => item.id)).toEqual([...pool.map((item) => item.id)].sort());
  });

  it('sin un grupo de alguna dificultad no hay tablero ni pool', () => {
    const without = groups.filter((content) => content.payload.difficulty !== 3);
    expect(poolOf(people, without, allSeries, config)).toEqual([]);
  });

  it('un grupo cuyos miembros se pisan con los de todas las alternativas, hasta quedarse sin elementos propios, no entra', () => {
    // El grupo "tapado" de dificultad 4 está contenido en los demás: no tiene elementos exclusivos con ninguna combinación.
    const covered = [
      group('a', 1, ['p00', 'p01', 'p02', 'p03', 'p04']),
      group('b', 2, ['p10', 'p11', 'p12', 'p13', 'p14']),
      group('c', 3, ['p20', 'p21', 'p22', 'p23', 'p24']),
      group('d', 4, ['p30', 'p31', 'p32', 'p33', 'p34']),
      group('tapado', 4, ['p00', 'p01', 'p10', 'p11', 'p20']),
    ];
    const pool = poolOf(people, covered, allSeries, config);
    expect(pool.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('regla 2: apagar la serie de los grupos de una dificultad deja el pool vacío', () => {
    const contents = groups.map((content) => (content.payload.difficulty === 4 ? { ...content, series: 's2' } : content));
    expect(poolOf(people, contents, ['s1'], config)).toEqual([]);
    expect(poolOf(people, contents, ['s1', 's2'], config).length).toBeGreaterThan(0);
  });
});

/** Todo lo que tiene que cumplir un tablero, por sí mismo. */
function expectValidBoard(board: Board, content: readonly Content[], message: string) {
  expect(board.groups.map((item) => item.difficulty), message).toEqual([...DIFFICULTIES]);
  const everyone = board.groups.flatMap((item) => item.members);
  expect(everyone, message).toHaveLength(DIFFICULTIES.length * GROUP_SIZE);
  expect(new Set(everyone).size, `${message}: elementos distintos`).toBe(everyone.length);
  expect([...board.start].sort(), message).toEqual([...everyone].sort());
  expect(hasSolvedRow(board.start, board.groups), `${message}: fila resuelta`).toBe(false);

  // Solución única: con la lista COMPLETA de miembros de cada grupo elegido, cada elemento está en uno solo.
  const full = new Map(content.map((item) => [item.id, new Set(item.payload.members as string[])]));
  for (const item of board.groups) {
    expect(item.members, message).toHaveLength(GROUP_SIZE);
    for (const member of item.members) {
      const owners = board.groups.filter((other) => full.get(other.id)?.has(member));
      expect(owners.map((other) => other.id), `${message}: ${member}`).toEqual([item.id]);
    }
  }
}

describe('buildBoard', () => {
  const pool = poolOf(people, groups, allSeries, config);

  it('arma un grupo de cada dificultad, con 4 elementos exclusivos cada uno', () => {
    const board = buildBoard(pool, ctx);
    expect(board).not.toBeNull();
    expectValidBoard(board!, groups, 'día 100');
  });

  it('tiene solución única en 500 días seguidos, con los elementos distintos y sin filas ya resueltas', () => {
    for (let day = 0; day < 500; day++) {
      const board = buildBoard(pool, { ...ctx, day });
      expect(board, `día ${day}`).not.toBeNull();
      expectValidBoard(board!, groups, `día ${day}`);
    }
  });

  it('es el mismo tablero para los mismos filtros y día, cualquiera sea el orden del pool', () => {
    const first = JSON.stringify(buildBoard(pool, ctx));
    for (let call = 0; call < 200; call++) expect(JSON.stringify(buildBoard(call % 2 === 0 ? pool : [...pool].reverse(), ctx))).toBe(first);
  });

  it('cambia con el día, con los filtros y con el modo', () => {
    const board = (c: DailyContext) => JSON.stringify(buildBoard(pool, c));
    const days = new Set(Array.from({ length: 30 }, (_, day) => board({ ...ctx, day })));
    expect(days.size).toBeGreaterThan(25);
    expect(board({ ...ctx, filterKey: 's1' })).not.toBe(board(ctx));
    expect(board({ ...ctx, mode: 'otro' })).not.toBe(board(ctx));
  });

  it('vectores fijos: el tablero de ciertos días no cambia nunca', () => {
    const summary = (day: number) => {
      const board = buildBoard(pool, { ...ctx, day })!;
      return `${board.groups.map((item) => `${item.id}:${item.members.join(',')}`).join(' | ')} || ${board.start.join(',')}`;
    };
    expect(summary(0)).toBe(
      'a3:p12,p14,p16,p17 | b1:p20,p21,p22,p23 | c1:p02,p34,p36,p37 | d2:p06,p25,p30,p39 || p06,p21,p16,p23,p22,p25,p14,p20,p12,p37,p39,p17,p36,p34,p30,p02',
    );
    expect(summary(1)).toBe(
      'a3:p13,p14,p15,p16 | b2:p10,p25,p26,p28 | c1:p03,p19,p35,p36 | d1:p00,p05,p29,p38 || p25,p03,p15,p29,p14,p05,p36,p10,p35,p00,p16,p28,p26,p19,p13,p38',
    );
    expect(summary(2)).toBe(
      'a2:p05,p07,p09,p11 | b1:p00,p20,p22,p23 | c1:p02,p03,p36,p37 | d2:p13,p25,p30,p39 || p23,p11,p36,p02,p03,p13,p00,p37,p09,p39,p30,p22,p05,p07,p25,p20',
    );
  });

  it('sin pool no hay tablero', () => {
    expect(buildBoard([], ctx)).toBeNull();
    expect(buildBoard(pool.filter((item) => item.difficulty !== 2), ctx)).toBeNull();
  });
});

describe('hasSolvedRow', () => {
  const grouped = [
    { id: 'g1', name: 'G1', difficulty: 1, members: ['a', 'b', 'c', 'd'] },
    { id: 'g2', name: 'G2', difficulty: 2, members: ['e', 'f', 'g', 'h'] },
  ];

  it('detecta una fila de 4 seguidos que es un grupo', () => {
    expect(hasSolvedRow(['x', 'y', 'z', 'w', 'a', 'b', 'c', 'd'], grouped)).toBe(true);
    expect(hasSolvedRow(['d', 'c', 'b', 'a', 'x', 'y', 'z', 'w'], grouped)).toBe(true);
  });

  it('una fila mezclada o que cruza dos filas no cuenta', () => {
    expect(hasSolvedRow(['x', 'y', 'z', 'a', 'b', 'c', 'd', 'w'], grouped)).toBe(false);
    expect(hasSolvedRow(['a', 'b', 'e', 'f', 'c', 'd', 'g', 'h'], grouped)).toBe(false);
  });
});

describe('judge', () => {
  const candidates = [
    { id: 'g1', name: 'G1', difficulty: 1, members: ['a', 'b', 'c', 'd'] },
    { id: 'g2', name: 'G2', difficulty: 2, members: ['e', 'f', 'g', 'h'] },
  ];

  it('4 de un mismo grupo es correcto, en cualquier orden', () => {
    expect(judge(['d', 'a', 'c', 'b'], candidates)).toEqual({ kind: 'correct', group: candidates[0] });
    expect(judge(['e', 'f', 'g', 'h'], candidates)).toEqual({ kind: 'correct', group: candidates[1] });
  });

  it('3 de un grupo y 1 de otro: a uno de distancia', () => {
    expect(judge(['a', 'b', 'c', 'e'], candidates)).toEqual({ kind: 'oneAway' });
  });

  it('2 y 2, o 1 de cada uno: incorrecto', () => {
    expect(judge(['a', 'b', 'e', 'f'], candidates)).toEqual({ kind: 'wrong' });
    expect(judge(['a', 'e', 'x', 'y'], candidates)).toEqual({ kind: 'wrong' });
  });

  it('solo se compara con los grupos que faltan: uno ya resuelto no cuenta', () => {
    expect(judge(['a', 'b', 'c', 'd'], [candidates[1]])).toEqual({ kind: 'wrong' });
  });
});

describe('progressOf', () => {
  const board: Board = {
    groups: [
      { id: 'g1', name: 'G1', difficulty: 1, members: ['a', 'b', 'c', 'd'] },
      { id: 'g2', name: 'G2', difficulty: 2, members: ['e', 'f', 'g', 'h'] },
      { id: 'g3', name: 'G3', difficulty: 3, members: ['i', 'j', 'k', 'l'] },
      { id: 'g4', name: 'G4', difficulty: 4, members: ['m', 'n', 'o', 'p'] },
    ],
    start: ['a', 'e', 'i', 'm', 'b', 'f', 'j', 'n', 'c', 'g', 'k', 'o', 'd', 'h', 'l', 'p'],
  };
  const g1 = ['a', 'b', 'c', 'd'];
  const g2 = ['e', 'f', 'g', 'h'];
  const g3 = ['i', 'j', 'k', 'l'];
  const wrong = ['a', 'e', 'i', 'm'];

  it('sin selecciones, nada resuelto', () => {
    expect(progressOf([], board, 4)).toEqual({ solved: [], mistakes: 0, won: false, over: false });
  });

  it('cada grupo correcto se suma en el orden en que se resolvió; cada selección incorrecta, un error', () => {
    const progress = progressOf([g2, wrong, g1], board, 4);
    expect(progress.solved.map((item) => item.id)).toEqual(['g2', 'g1']);
    expect(progress.mistakes).toBe(1);
    expect(progress.over).toBe(false);
  });

  it('al resolver tres, el cuarto queda resuelto solo y se gana', () => {
    const progress = progressOf([g1, g2, g3], board, 4);
    expect(progress.solved.map((item) => item.id)).toEqual(['g1', 'g2', 'g3', 'g4']);
    expect(progress.won).toBe(true);
    expect(progress.over).toBe(true);
    expect(progress.mistakes).toBe(0);
  });

  it('con 4 errores se pierde, y lo que venga después no cuenta', () => {
    const lost = progressOf([wrong, ['a', 'f', 'k', 'p'], ['b', 'g', 'l', 'm'], ['c', 'h', 'i', 'n'], g1], board, 4);
    expect(lost).toMatchObject({ mistakes: 4, won: false, over: true });
    expect(lost.solved).toEqual([]);
  });

  it('se puede ganar con un error de margen', () => {
    const progress = progressOf([wrong, g1, g2, g3], board, 4);
    expect(progress).toMatchObject({ won: true, mistakes: 1 });
  });
});

describe('isRepeat', () => {
  it('es repetida una selección con los mismos elementos en cualquier orden', () => {
    expect(isRepeat(['a', 'b', 'c', 'd'], [['d', 'c', 'b', 'a']])).toBe(true);
    expect(isRepeat(['a', 'b', 'c', 'd'], [['a', 'b', 'c', 'e']])).toBe(false);
    expect(isRepeat(['a', 'b', 'c', 'd'], [])).toBe(false);
  });
});

describe('restoreAttempts', () => {
  const board: Board = {
    groups: [
      { id: 'g1', name: 'G1', difficulty: 1, members: ['a', 'b', 'c', 'd'] },
      { id: 'g2', name: 'G2', difficulty: 2, members: ['e', 'f', 'g', 'h'] },
      { id: 'g3', name: 'G3', difficulty: 3, members: ['i', 'j', 'k', 'l'] },
      { id: 'g4', name: 'G4', difficulty: 4, members: ['m', 'n', 'o', 'p'] },
    ],
    start: ['a', 'e', 'i', 'm', 'b', 'f', 'j', 'n', 'c', 'g', 'k', 'o', 'd', 'h', 'l', 'p'],
  };
  const wrong = ['a', 'e', 'i', 'm'];

  it('sin nada guardado, no hay selecciones', () => {
    expect(restoreAttempts(undefined, board, 4)).toEqual([]);
    expect(restoreAttempts([], board, 4)).toEqual([]);
  });

  it('conserva las válidas, en orden', () => {
    expect(restoreAttempts([wrong, ['a', 'b', 'c', 'd']], board, 4)).toEqual([wrong, ['a', 'b', 'c', 'd']]);
  });

  it('corta en la primera inválida: tamaño distinto, elemento desconocido, repetidos o no son textos', () => {
    expect(restoreAttempts([wrong, ['a', 'b', 'c'], wrong], board, 4)).toEqual([wrong]);
    expect(restoreAttempts([['a', 'b', 'c', 'zzz']], board, 4)).toEqual([]);
    expect(restoreAttempts([['a', 'a', 'b', 'c']], board, 4)).toEqual([]);
    expect(restoreAttempts([['a', 'b', 'c', 1]], board, 4)).toEqual([]);
    expect(restoreAttempts(['abcd'], board, 4)).toEqual([]);
  });

  it('descarta una selección repetida y una que usa elementos de un grupo ya resuelto', () => {
    expect(restoreAttempts([wrong, ['m', 'i', 'e', 'a']], board, 4)).toEqual([wrong]);
    expect(restoreAttempts([['a', 'b', 'c', 'd'], ['a', 'e', 'f', 'g']], board, 4)).toEqual([['a', 'b', 'c', 'd']]);
  });

  it('no guarda nada después de terminar', () => {
    const lost = [wrong, ['a', 'f', 'k', 'p'], ['b', 'g', 'l', 'm'], ['c', 'h', 'i', 'n'], ['d', 'e', 'j', 'o']];
    expect(restoreAttempts(lost, board, 4)).toEqual(lost.slice(0, 4));
    const won = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h'], ['i', 'j', 'k', 'l'], wrong];
    expect(restoreAttempts(won, board, 4)).toEqual(won.slice(0, 3));
  });
});

describe('shareGrid', () => {
  const board: Board = {
    groups: [
      { id: 'g1', name: 'G1', difficulty: 1, members: ['a', 'b', 'c', 'd'] },
      { id: 'g2', name: 'G2', difficulty: 2, members: ['e', 'f', 'g', 'h'] },
      { id: 'g3', name: 'G3', difficulty: 3, members: ['i', 'j', 'k', 'l'] },
      { id: 'g4', name: 'G4', difficulty: 4, members: ['m', 'n', 'o', 'p'] },
    ],
    start: [],
  };

  it('un cuadrado por elemento con el color de su grupo, del más fácil al más difícil, una línea por selección', () => {
    expect(shareGrid([['m', 'a', 'e', 'i'], ['d', 'c', 'b', 'a'], ['p', 'n', 'o', 'm']], board)).toEqual(['🟨🟩🟦🟪', '🟨🟨🟨🟨', '🟪🟪🟪🟪']);
  });

  it('no contiene nombres ni ids', () => {
    expect(shareGrid([['a', 'e', 'i', 'm']], board).join('')).toMatch(/^[🟨🟩🟦🟪]+$/u);
  });
});

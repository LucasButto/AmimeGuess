import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pickDaily, type DailyContext } from '@/engine/daily';
import type { Content, Entity } from '@/engine/types';
import {
  acceptedIds,
  candidatesOf,
  failedCount,
  isCorrect,
  lineStates,
  lineText,
  pickContent,
  restoreAttempts,
  shareGrid,
  winningAttempt,
  type Candidate,
} from './logic';
import type { TextClueConfig } from './types';

const entity = (id: string, series: string[], attrs: Entity['attrs'] = {}): Entity => ({
  id,
  name: { es: id },
  aliases: [],
  series,
  image: `test/${id}`,
  attrs,
});

const clue = (id: string, entityId: string | undefined, series: string, payload: Record<string, unknown>, kind = 'dex'): Content => ({
  id,
  kind,
  entityId,
  series,
  payload,
  verified: true,
});

const CONFIG: TextClueConfig = {
  contentKind: 'dex',
  lines: [
    { kind: 'content', label: 'Descripción', after: 0, field: 'text' },
    { kind: 'attr', label: 'Tipos', after: 3, keys: ['tipo1', 'tipo2'] },
    { kind: 'attr', label: 'Generación', after: 6, keys: ['generacion'] },
  ],
};

const ctx: DailyContext = { franchise: 'test', mode: 'descripcion', filterKey: 'all', day: 100 };

describe('lineText', () => {
  const bulbasaur = entity('bulbasaur', ['g1'], { tipo1: 'Planta', tipo2: 'Veneno', generacion: 1, colores: ['Verde', 'Azul'], vacio: [], nada: null });
  const dex = clue('dex-bulbasaur', 'bulbasaur', 'g1', { text: 'Una semilla.', numero: 25, cadena: '' });

  it('lee un campo de texto del contenido', () => {
    expect(lineText({ kind: 'content', label: 'x', after: 0, field: 'text' }, bulbasaur, dex)).toBe('Una semilla.');
  });

  it('un número del contenido se muestra como texto', () => {
    expect(lineText({ kind: 'content', label: 'x', after: 0, field: 'numero' }, bulbasaur, dex)).toBe('25');
  });

  it('un campo que falta, vacío o que no es texto es "no hay dato"', () => {
    for (const field of ['no-existe', 'cadena']) {
      expect(lineText({ kind: 'content', label: 'x', after: 0, field }, bulbasaur, dex)).toBeNull();
    }
    const odd = clue('c', 'bulbasaur', 'g1', { lista: ['a'], objeto: {} });
    expect(lineText({ kind: 'content', label: 'x', after: 0, field: 'lista' }, bulbasaur, odd)).toBeNull();
    expect(lineText({ kind: 'content', label: 'x', after: 0, field: 'objeto' }, bulbasaur, odd)).toBeNull();
  });

  it('junta varios atributos con " / " y omite los que no tienen valor', () => {
    expect(lineText({ kind: 'attr', label: 'x', after: 0, keys: ['tipo1', 'tipo2'] }, bulbasaur, dex)).toBe('Planta / Veneno');
    const mono = entity('squirtle', ['g1'], { tipo1: 'Agua', tipo2: null });
    expect(lineText({ kind: 'attr', label: 'x', after: 0, keys: ['tipo1', 'tipo2'] }, mono, dex)).toBe('Agua');
  });

  it('un atributo numérico y uno de lista se muestran como texto', () => {
    expect(lineText({ kind: 'attr', label: 'x', after: 0, keys: ['generacion'] }, bulbasaur, dex)).toBe('1');
    expect(lineText({ kind: 'attr', label: 'x', after: 0, keys: ['colores'] }, bulbasaur, dex)).toBe('Verde, Azul');
  });

  it('un atributo sin valor, vacío o inexistente es "no hay dato"', () => {
    for (const key of ['nada', 'vacio', 'no-existe']) {
      expect(lineText({ kind: 'attr', label: 'x', after: 0, keys: [key] }, bulbasaur, dex)).toBeNull();
    }
  });
});

describe('candidatesOf', () => {
  const entities = [entity('a', ['g1']), entity('b', ['g2']), entity('c', ['g1']), entity('d', ['g1', 'g3'])];
  const contents = [
    clue('dex-a', 'a', 'g1', { text: 'Texto A' }),
    clue('dex-b', 'b', 'g2', { text: 'Texto B' }),
    clue('otro-c', 'c', 'g1', { text: 'Texto C' }, 'quote'),
    clue('dex-huerfano', undefined, 'g1', { text: 'Sin dueño' }),
    clue('dex-d', 'd', 'g1', { text: 'Texto D' }),
  ];

  it('ofrece las entidades elegibles que tienen un contenido del tipo pedido', () => {
    expect(candidatesOf(entities, contents, ['g1', 'g2'], CONFIG).map((c) => c.id)).toEqual(['a', 'b', 'd']);
  });

  it('con una serie apagada, ni la entidad ni sus contenidos aparecen (reglas 1 y 2)', () => {
    expect(candidatesOf(entities, contents, ['g1'], CONFIG).map((c) => c.id)).toEqual(['a', 'd']);
    expect(candidatesOf(entities, contents, ['g2'], CONFIG).map((c) => c.id)).toEqual(['b']);
  });

  it('un contenido de una serie inactiva no cuenta aunque la entidad sea elegible', () => {
    // d es de g1 y g3 pero su contenido es de g1: con solo g3 activo no hay nada que mostrar.
    expect(candidatesOf(entities, contents, ['g3'], CONFIG)).toEqual([]);
  });

  it('descarta el contenido al que le falta la pista principal', () => {
    const broken = [clue('dex-a', 'a', 'g1', { text: '' }), clue('dex-c', 'c', 'g1', { otra: 'cosa' })];
    expect(candidatesOf(entities, broken, ['g1'], CONFIG)).toEqual([]);
  });

  it('un dato que falta en una pista extra no descarta el contenido', () => {
    const [only] = candidatesOf(entities, [contents[0]], ['g1'], CONFIG);
    expect(only.id).toBe('a');
  });

  it('ordena los contenidos por id, sin depender del orden de los datos', () => {
    const many = [clue('m-2', 'a', 'g1', { text: '2' }), clue('m-1', 'a', 'g1', { text: '1' })];
    const [first] = candidatesOf(entities, many, ['g1'], CONFIG);
    expect(first.contents.map((c) => c.id)).toEqual(['m-1', 'm-2']);
  });
});

describe('pickContent', () => {
  const candidate: Candidate = {
    id: 'a',
    entity: entity('a', ['g1']),
    contents: ['m1', 'm2', 'm3'].map((id) => clue(id, 'a', 'g1', { text: id })),
  };

  it('con un solo contenido, ese', () => {
    expect(pickContent({ ...candidate, contents: [candidate.contents[0]] }, ctx)).toBe(candidate.contents[0]);
  });

  it('es determinista', () => {
    const first = pickContent(candidate, ctx);
    for (let i = 0; i < 100; i++) expect(pickContent(candidate, ctx)).toBe(first);
  });

  it('cambia con los días y los usa todos', () => {
    const seen = new Set<string>();
    for (let day = 0; day < 200; day++) seen.add(pickContent(candidate, { ...ctx, day }).id);
    expect(seen.size).toBe(3);
  });
});

describe('respuestas equivalentes', () => {
  const volt = clue('volt-pikachu', 'pikachu', 'g1', { name: 'Placaje Eléctrico', accepts: ['pichu', 'raichu'] });

  it('lee la lista de ids que acepta el contenido', () => {
    expect(acceptedIds(volt)).toEqual(['pichu', 'raichu']);
    expect(acceptedIds(clue('c', 'a', 'g1', {}))).toEqual([]);
    expect(acceptedIds(clue('c', 'a', 'g1', { accepts: 'pichu' }))).toEqual([]);
    expect(acceptedIds(clue('c', 'a', 'g1', { accepts: ['pichu', 3, null] }))).toEqual(['pichu']);
  });

  it('acierta la respuesta del día y las que el contenido acepta', () => {
    expect(isCorrect('pikachu', 'pikachu', volt)).toBe(true);
    expect(isCorrect('raichu', 'pikachu', volt)).toBe(true);
    expect(isCorrect('pichu', 'pikachu', volt)).toBe(true);
    expect(isCorrect('eevee', 'pikachu', volt)).toBe(false);
  });

  it('sin lista, solo acierta la respuesta del día', () => {
    expect(isCorrect('raichu', 'pikachu', clue('c', 'pikachu', 'g1', {}))).toBe(false);
  });

  it('encuentra el primer intento que acertó', () => {
    expect(winningAttempt(['eevee', 'raichu', 'pikachu'], 'pikachu', volt)).toBe('raichu');
    expect(winningAttempt(['eevee', 'mew'], 'pikachu', volt)).toBeNull();
    expect(winningAttempt([], 'pikachu', volt)).toBeNull();
  });

  it('un acierto equivalente no cuenta como fallo', () => {
    expect(failedCount(['eevee', 'mew', 'raichu'], 'pikachu', volt)).toBe(2);
    expect(failedCount([], 'pikachu', volt)).toBe(0);
  });
});

describe('lineStates', () => {
  const bulbasaur = entity('bulbasaur', ['g1'], { tipo1: 'Planta', tipo2: 'Veneno', generacion: 1 });
  const dex = clue('dex-bulbasaur', 'bulbasaur', 'g1', { text: 'Una semilla.' });

  it('abre la pista principal y bloquea el resto según los fallos', () => {
    const at = (failed: number) => lineStates(CONFIG.lines, failed, bulbasaur, dex).map((s) => [s.unlocked, s.remaining]);
    expect(at(0)).toEqual([[true, 0], [false, 3], [false, 6]]);
    expect(at(2)).toEqual([[true, 0], [false, 1], [false, 4]]);
    expect(at(3)).toEqual([[true, 0], [true, 0], [false, 3]]);
    expect(at(6)).toEqual([[true, 0], [true, 0], [true, 0]]);
    expect(at(40)).toEqual([[true, 0], [true, 0], [true, 0]]);
  });

  it('con Infinity (partida terminada) todas quedan abiertas', () => {
    expect(lineStates(CONFIG.lines, Infinity, bulbasaur, dex).every((s) => s.unlocked && s.remaining === 0)).toBe(true);
  });

  it('omite las líneas cuyo dato no existe', () => {
    const mew = entity('mew', ['g1'], { tipo1: 'Psíquico' });
    const states = lineStates(CONFIG.lines, 10, mew, dex);
    expect(states.map((s) => s.line.label)).toEqual(['Descripción', 'Tipos']);
  });

  it('trae el texto de cada línea', () => {
    expect(lineStates(CONFIG.lines, 0, bulbasaur, dex).map((s) => s.text)).toEqual(['Una semilla.', 'Planta / Veneno', '1']);
  });
});

describe('el reto del día', () => {
  it('dos dispositivos con los mismos filtros ven la misma respuesta y contenido', () => {
    const entities = Array.from({ length: 40 }, (_, i) => entity(`e${String(i).padStart(2, '0')}`, ['g1']));
    const contents = entities.flatMap((e) => [clue(`m-${e.id}-1`, e.id, 'g1', { text: '1' }), clue(`m-${e.id}-2`, e.id, 'g1', { text: '2' })]);
    const play = (e = entities, c = contents) => {
      const candidates = candidatesOf(e, c, ['g1'], CONFIG);
      const answer = pickDaily(candidates, ctx);
      return { id: answer.id, content: pickContent(answer, ctx).id };
    };
    expect(play()).toEqual(play());
    expect(play([...entities].reverse(), [...contents].reverse())).toEqual(play());
  });
});

describe('intentos', () => {
  it('restaura solo intentos válidos y sin repetidos', () => {
    const options = [{ id: 'a' }, { id: 'b' }];
    expect(restoreAttempts(['a', 'x', 'a', 3, 'b'], options)).toEqual(['a', 'b']);
    expect(restoreAttempts(undefined, options)).toEqual([]);
  });

  it('la grilla para compartir tiene una línea por intento, solo con colores', () => {
    expect(shareGrid(['x', 'y', 'ans'], 'ans')).toEqual(['🟥', '🟥', '🟩']);
    expect(shareGrid(['x', 'y'], null)).toEqual(['🟥', '🟥']);
    expect(shareGrid([], 'ans')).toEqual([]);
  });
});

describe('src/modes/text-clue', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const code = readFileSync(`${dir}logic.ts`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('la lógica no usa azar ni reloj (regla 1 de CLAUDE.md)', () => {
    for (const pattern of [/Math\.random\b/, /Date\.now\b/, /new Date\(/, /getTimezoneOffset/, /performance\.now\b/]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('la lógica no importa React ni nada de una franquicia (regla 2)', () => {
    expect(code).not.toMatch(/from\s+['"](react|next|@\/franchises|@\/components)/);
  });
});

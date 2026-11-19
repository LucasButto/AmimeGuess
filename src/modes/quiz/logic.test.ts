import { describe, expect, it } from 'vitest';
import type { DailyContext } from '@/engine/daily';
import type { Content, Entity } from '@/engine/types';
import { optionCountOf, optionsFor, poolOf, questionOf, replay, shareGrid, type Question } from './logic';
import type { QuizConfig } from './types';

const config: QuizConfig = {
  contentKind: 'question',
  questionField: 'question',
  correctField: 'correct',
  distractorsField: 'distractors',
  explanationField: 'explanation',
  scopeField: 'scope',
};

const people = (count: number, series: string[] = ['a']): Entity[] =>
  Array.from({ length: count }, (_, index) => ({ id: `p${String(index).padStart(2, '0')}`, name: { es: `Persona ${index}` }, aliases: [], series, attrs: {} }));

/** Una pregunta de la serie `series` con 11 distractores (p01 a p11) y la respuesta p00. */
const question = (id: string, series = 'a', extra: Partial<Content['payload']> = {}): Content => ({
  id: `question-${id}`,
  kind: 'question',
  series,
  verified: false,
  payload: {
    question: `Pregunta ${id}`,
    scope: 'Alcance',
    correct: 'p00',
    distractors: Array.from({ length: 11 }, (_, index) => `p${String(index + 1).padStart(2, '0')}`),
    explanation: `Dato ${id}`,
    ...extra,
  },
});

const entities = people(20);
const contents = Array.from({ length: 30 }, (_, index) => question(String(index).padStart(2, '0')));
const ctx: DailyContext = { franchise: 'f', mode: 'quiz', filterKey: 'all', day: 5 };

describe('config', () => {
  it('tiene 12 opciones por defecto, o las que diga la configuración', () => {
    expect(optionCountOf(config)).toBe(12);
    expect(optionCountOf({ ...config, options: 8 })).toBe(8);
    expect(optionCountOf({ ...config, options: 1 })).toBe(2);
  });
});

describe('poolOf', () => {
  it('toma las preguntas de las series activas, ordenadas por id', () => {
    const mixed = [question('b', 'a'), question('a', 'a'), question('c', 'b')];
    const cast = people(20, ['a', 'b']);
    expect(poolOf(cast, mixed, ['a'], config).map((item) => item.id)).toEqual(['question-a', 'question-b']);
    expect(poolOf(cast, mixed, ['b'], config).map((item) => item.id)).toEqual(['question-c']);
    expect(poolOf(cast, mixed, ['a', 'b'], config)).toHaveLength(3);
  });

  it('descarta las preguntas mal formadas o sin opciones suficientes', () => {
    const bad = [
      question('sin-texto', 'a', { question: '' }),
      question('sin-respuesta', 'a', { correct: undefined }),
      question('pocas', 'a', { distractors: ['p01', 'p02', 'p03'] }),
      question('repetidas', 'a', { distractors: Array(11).fill('p01') }),
      question('ok'),
    ];
    expect(poolOf(entities, bad, ['a'], config).map((item) => item.id)).toEqual(['question-ok']);
  });

  it('pide los distractores de las opciones de la configuración', () => {
    const few = [question('x', 'a', { distractors: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07'] })];
    expect(poolOf(entities, few, ['a'], { ...config, options: 4 })).toHaveLength(1);
    expect(poolOf(entities, few, ['a'], { ...config, options: 8 })).toHaveLength(1);
    expect(poolOf(entities, few, ['a'], config)).toEqual([]);
  });

  it('lo que se apaga no aparece: ni la respuesta ni los distractores de una serie inactiva', () => {
    const cast = [...people(6, ['a']), ...people(20).slice(6).map((entity) => ({ ...entity, series: ['b'] }))];
    // Con la serie b apagada solo quedan 6 personajes elegibles: no alcanzan 11 distractores y la pregunta no sale.
    expect(poolOf(cast, [question('x')], ['a'], config)).toEqual([]);
    // Con menos opciones (3 distractores) sí alcanzan.
    expect(poolOf(cast, [question('x')], ['a'], { ...config, options: 4 })).toHaveLength(1);
    // Con las dos activas, sí en todas.
    expect(poolOf(cast, [question('x')], ['a', 'b'], config)).toHaveLength(1);
    // Si la respuesta es de la serie apagada, tampoco.
    const answerOff = cast.map((entity) => (entity.id === 'p00' ? { ...entity, series: ['b'] } : { ...entity, series: ['a'] }));
    expect(poolOf(answerOff, [question('x')], ['a'], { ...config, options: 4 })).toEqual([]);
  });

  it('quita de los distractores a quien no es elegible, siempre que sobren', () => {
    const extra: Entity[] = [...people(20), { id: 'p20', name: { es: 'Extra' }, aliases: [], series: ['b'], attrs: {} }];
    const wide = question('x', 'a', { distractors: [...Array.from({ length: 11 }, (_, index) => `p${String(index + 1).padStart(2, '0')}`), 'p20'] });
    const [item] = poolOf(extra, [wide], ['a'], config);
    expect(item.distractors).toHaveLength(11);
    expect(item.distractors).not.toContain('p20');
  });
});

describe('questionOf', () => {
  const pool = poolOf(entities, contents, ['a'], config);

  it('devuelve siempre la misma pregunta para el mismo contexto, sin importar el orden de los datos', () => {
    const first = questionOf(pool, ctx)!;
    expect(first).not.toBeNull();
    expect(questionOf(pool, ctx)).toEqual(first);
    expect(questionOf([...pool].reverse(), ctx)).toEqual(first);
  });

  it('no repite ninguna pregunta hasta pasar por todo el pool, y vuelve a empezar con otro orden', () => {
    const first = Array.from({ length: 30 }, (_, day) => questionOf(pool, { ...ctx, day })!.id);
    expect(new Set(first).size).toBe(30);
    const second = Array.from({ length: 30 }, (_, day) => questionOf(pool, { ...ctx, day: day + 30 })!.id);
    expect(new Set(second).size).toBe(30);
    expect(second).not.toEqual(first);
  });

  it('cambia con los filtros', () => {
    const days = Array.from({ length: 30 }, (_, day) => day);
    const ids = (filterKey: string) => days.map((day) => questionOf(pool, { ...ctx, filterKey, day })!.id).join();
    expect(ids('a')).not.toBe(ids('all'));
    expect(ids('all~x')).not.toBe(ids('all'));
  });

  it('con el pool vacío devuelve null y funciona con días negativos (el "ayer" del día cero)', () => {
    expect(questionOf([], ctx)).toBeNull();
    expect(questionOf(pool, { ...ctx, day: -1 })).not.toBeNull();
  });
});

describe('optionsFor', () => {
  const [item] = poolOf(entities, contents, ['a'], config);

  it('trae la correcta y count - 1 distractores distintos, siempre iguales para el mismo contexto', () => {
    for (const count of [4, 8, 12]) {
      const options = optionsFor(item, count, ctx);
      expect(options).toHaveLength(count);
      expect(new Set(options).size).toBe(count);
      expect(options).toContain(item.correct);
      expect(optionsFor(item, count, ctx)).toEqual(options);
    }
  });

  it('la correcta no cae siempre en el mismo lugar', () => {
    const places = new Set(poolOf(entities, contents, ['a'], config).map((q) => optionsFor(q, 12, ctx).indexOf(q.correct)));
    expect(places.size).toBeGreaterThan(3);
  });

  it('con menos distractores que opciones pedidas usa los que hay', () => {
    const short: Question = { ...item, distractors: ['p01', 'p02'] };
    expect(optionsFor(short, 12, ctx)).toHaveLength(3);
  });
});

describe('replay', () => {
  const options = ['p03', 'p00', 'p07', 'p09'];
  const asked = { correct: 'p00' };

  it('sin elecciones, ni resuelta ni terminada', () => {
    expect(replay(undefined, options, asked, 1)).toEqual({ picks: [], solved: false, over: false, mistakes: 0 });
  });

  it('con un solo intento, la primera elección cierra la pregunta', () => {
    expect(replay(['p00'], options, asked, 1)).toEqual({ picks: ['p00'], solved: true, over: true, mistakes: 0 });
    expect(replay(['p07'], options, asked, 1)).toEqual({ picks: ['p07'], solved: false, over: true, mistakes: 1 });
    // Lo que sobra después del último intento se ignora.
    expect(replay(['p07', 'p00'], options, asked, 1).picks).toEqual(['p07']);
  });

  it('con varios intentos, cada incorrecta se descarta y se sigue hasta acertar o gastarlos', () => {
    expect(replay(['p03'], options, asked, 3)).toMatchObject({ solved: false, over: false, mistakes: 1 });
    expect(replay(['p03', 'p07', 'p00'], options, asked, 3)).toEqual({ picks: ['p03', 'p07', 'p00'], solved: true, over: true, mistakes: 2 });
    expect(replay(['p03', 'p07', 'p09'], options, asked, 3)).toMatchObject({ solved: false, over: true, mistakes: 3 });
  });

  it('sin límite (una sala) sigue hasta dar con la correcta y nada cuenta después', () => {
    const progress = replay(['p03', 'p07', 'p09', 'p00', 'p03'], options, asked, Infinity);
    expect(progress.picks).toEqual(['p03', 'p07', 'p09', 'p00']);
    expect(progress.solved).toBe(true);
    expect(progress.mistakes).toBe(3);
  });

  it('una elección que no es una opción de hoy o que se repite corta la lectura ahí', () => {
    expect(replay(['p03', 'nadie', 'p00'], options, asked, 3).picks).toEqual(['p03']);
    expect(replay(['p03', 'p03'], options, asked, 3).picks).toEqual(['p03']);
    expect(replay([42, 'p00'], options, asked, 3).picks).toEqual([]);
  });
});

describe('shareGrid', () => {
  it('un cuadrado por elección en una línea: rojo si no era, verde la correcta; sin decir cuáles eran', () => {
    expect(shareGrid({ picks: ['a', 'b', 'c'], mistakes: 2, solved: true })).toEqual(['🟥🟥🟩']);
    expect(shareGrid({ picks: ['a', 'b'], mistakes: 2, solved: false })).toEqual(['🟥🟥']);
    expect(shareGrid({ picks: [], mistakes: 0, solved: false })).toEqual([]);
  });
});

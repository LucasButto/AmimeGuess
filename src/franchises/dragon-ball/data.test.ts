// Pruebas sobre los datos reales de Dragon Ball (data/dragon-ball/) y su config: lo que los tests
// de la lógica no pueden ver. La regla central de la SPEC: lo que se apaga no aparece nunca. Con
// cada serie apagada, ninguna entidad, forma, frase ni suceso suyo sale como respuesta, como opción
// ni como valor visible en ninguno de los modos.

import { beforeAll, describe, expect, it } from 'vitest';
import type { DailyContext } from '@/engine/daily';
import { defaultMinPool, eligibleEntities, hasMinimumPool, publishableContents } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { buildRow, cellText, visibleColumns } from '@/modes/classic/logic';
import { buildBoard, poolOf as connectionsPool } from '@/modes/connections/logic';
import { GROUP_SIZE } from '@/modes/connections/types';
import { candidatesOf as imageCandidates } from '@/modes/image-reveal/logic';
import { optionCountOf, optionsFor, poolOf as quizPool, questionOf } from '@/modes/quiz/logic';
import { candidatesOf as textCandidates } from '@/modes/text-clue/logic';
import { buildPuzzle, countOf, poolOf as timelinePool } from '@/modes/timeline/logic';
import { modeStatus } from '@/app/[franchise]/[mode]/playable';
import contentJson from '../../../data/dragon-ball/content.json';
import { dragonBallContents } from './content';
import entitiesJson from '../../../data/dragon-ball/entities.json';
import sagasJson from '../../../data/dragon-ball/sagas.json';
import quizSource from '../../../data/dragon-ball/source/quiz.json';
import { entitiesOfMode, loadFranchiseData, type FranchiseData } from '../data';
import type { ModeConfig } from '../types';
import { dragonBallConfig, sagaLabels } from './config';

const characters = entitiesJson as unknown as Entity[];
const rawContents = dragonBallContents(contentJson as Content[]);
// Se conservan las marcas del catálogo para comprobar qué publica cada modo.
// Para probar las reglas de exclusión sobre el contenido real se consideran verificados.
const contents = rawContents.map((content) => ({ ...content, verified: true }));
const modes: readonly ModeConfig[] = dragonBallConfig.modes;
const allSeries: readonly string[] = dragonBallConfig.series;

const mode = (slug: string): ModeConfig => {
  const found = modes.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`No existe el modo ${slug}`);
  return found;
};

const exclusiveTo = (entity: Pick<Entity, 'series'>, series: string) => entity.series.length === 1 && entity.series[0] === series;
const without = (series: string) => allSeries.filter((id) => id !== series);
const nameOf = new Map(characters.map((entity) => [entity.id, entity.name.es]));
const byId = new Map(characters.map((entity) => [entity.id, entity]));
/** Todas las combinaciones de series que se pueden dejar activas (31 con 5 series). */
const combinations: string[][] = Array.from({ length: 2 ** allSeries.length - 1 }, (_, bits) =>
  allSeries.filter((_, index) => ((bits + 1) >> index) & 1),
);
const ctx: DailyContext = { franchise: 'dragon-ball', mode: 'x', filterKey: 'all', day: 200 };

describe('config', () => {
  it('tiene los 8 modos, en orden y con su motor', () => {
    expect(modes.map((m) => [m.slug, m.engine])).toEqual([
      ['clasico', 'classic'],
      ['silueta', 'image-reveal'],
      ['frase', 'text-clue'],
      ['quiz', 'quiz'],
      ['tecnica', 'image-reveal'],
      ['linea-de-tiempo', 'timeline'],
      ['conexiones', 'connections'],
      ['casillas', 'category-board'],
    ]);
  });

  it('las columnas y las pistas del Clásico existen en todos los personajes', () => {
    const classic = mode('clasico').classic;
    expect(classic).toBeDefined();
    for (const column of classic?.columns ?? []) {
      for (const entity of characters) expect(column.key in entity.attrs, `${entity.id}.${column.key}`).toBe(true);
    }
    for (const hint of classic?.hints ?? []) {
      if (hint.kind !== 'attr') continue;
      for (const entity of characters) expect(hint.key in entity.attrs, `${entity.id}.${hint.key}`).toBe(true);
    }
  });

  it('la columna de saga de debut tiene nombre para cada número que aparece en los datos, y ya no hay columna de serie de debut', () => {
    const columns = Object.fromEntries((mode('clasico').classic?.columns ?? []).map((column) => [column.key, column]));
    expect(columns.serieDebut).toBeUndefined();
    const labels = columns.sagaDebut?.valueLabels;
    expect(labels).toBeDefined();
    for (const entity of characters) {
      expect(labels?.[String(entity.attrs.sagaDebut)], `${entity.id}.sagaDebut=${String(entity.attrs.sagaDebut)}`).toBeDefined();
    }
  });

  it('cada número de saga se muestra con el nombre corto de su saga y la serie a la que pertenece', () => {
    const labels = mode('clasico').classic?.columns.find((column) => column.key === 'sagaDebut')?.valueLabels ?? {};
    for (const saga of sagasJson.sagas) {
      expect(sagaLabels[saga.id], `falta el nombre corto de ${saga.id}`).toBeDefined();
      expect(labels[String(saga.order)]).toEqual({ label: sagaLabels[saga.id], series: saga.series });
    }
  });

  it('ya no están Nivel de poder ni Transformación, y todos los modos usan a los personajes', () => {
    expect(modes.some((candidate) => ['poder', 'transformacion'].includes(candidate.slug))).toBe(false);
    for (const other of modes) expect(other.entitySet, other.slug).toBeUndefined();
  });
});

describe('carga de datos', () => {
  let data: FranchiseData;
  beforeAll(async () => {
    data = (await loadFranchiseData('dragon-ball')) as FranchiseData;
  });

  it('trae los personajes y el contenido', () => {
    expect(data.entities).toHaveLength(characters.length);
    expect(data.entitySets).toBeUndefined();
    expect(entitiesOfMode(data, undefined)).toBe(data.entities);
    expect(data.contents.length).toBeLessThanOrEqual(rawContents.length);
  });

  it('habilita todo Frase y sigue filtrando los eventos sin verificar', () => {
    const quotes = rawContents.filter(({ kind }) => kind === 'quote');
    expect(data.contents.filter(({ kind }) => kind === 'quote')).toEqual(quotes);
    expect(data.contents.filter(({ kind }) => kind === 'event').every(({ verified }) => verified)).toBe(true);
    const config = mode('frase').textClue!;
    for (const active of [allSeries, ...allSeries.map((series) => [series])]) {
      const eligible = quotes.filter(({ series }) => active.includes(series));
      const pool = textCandidates(data.entities, data.contents, active, config);
      expect(pool).toHaveLength(new Set(eligible.map(({ entityId }) => entityId)).size);
      expect(pool.flatMap(({ contents }) => contents)).toHaveLength(eligible.length);
    }
  });

  it('lo demás sí entra, esté o no verificado', () => {
    const others = rawContents.filter((content) => content.kind !== 'quote' && content.kind !== 'event');
    expect(publishableContents(rawContents).filter((content) => content.kind !== 'quote' && content.kind !== 'event')).toHaveLength(others.length);
  });

  it('los modos con contenido de sobra están disponibles; los demás dependen de lo que haya y se oculta el que no alcanza', () => {
    for (const slug of ['clasico', 'silueta', 'quiz', 'conexiones']) {
      expect(modeStatus(dragonBallConfig, mode(slug), data), slug).toBe('playable');
    }
    // Un modo sin pool suficiente con todas las series se oculta de la navegación; nunca queda como "próximamente".
    for (const slug of ['frase', 'tecnica', 'linea-de-tiempo']) {
      expect(['playable', 'hidden'], slug).toContain(modeStatus(dragonBallConfig, mode(slug), data));
    }
  });

  it('una franquicia sin datos o un modo sin motor son "próximamente"', () => {
    expect(modeStatus(dragonBallConfig, mode('clasico'), undefined)).toBe('soon');
    expect(modeStatus(dragonBallConfig, { slug: 'x', name: 'X', engine: 'connections' }, data)).toBe('soon');
  });
});

describe('con una serie apagada no aparece nada de ella', () => {
  const quoteConfig = mode('frase').textClue!;
  const techniqueConfig = mode('tecnica').imageReveal!;
  const timelineConfig = mode('linea-de-tiempo').timeline!;

  it('hay personajes que debutaron en una serie y siguen en otras: con aquella apagada, su debut se oculta de verdad', () => {
    for (const off of ['gt', 'dbz']) {
      const active = without(off);
      const debuted = eligibleEntities(characters, active).filter((entity) => entity.series[0] === off);
      expect(debuted.length, off).toBeGreaterThan(0);
    }
  });

  for (const off of allSeries) {
    describe(`sin ${off}`, () => {
      const active = without(off);

      it('ningún personaje exclusivo de la serie es una opción ni una respuesta', () => {
        const options = eligibleEntities(characters, active);
        expect(options.some((entity) => exclusiveTo(entity, off))).toBe(false);
        expect(options.every((entity) => entity.series.some((id) => active.includes(id)))).toBe(true);
        for (const slug of ['silueta']) {
          const candidates = imageCandidates(characters, contents, active, mode(slug).imageReveal!);
          expect(candidates.some((candidate) => exclusiveTo(candidate.entity, off)), slug).toBe(false);
        }
      });

      it('en el Quiz no sale ninguna pregunta de la serie ni un personaje exclusivo suyo, ni como respuesta ni como opción', () => {
        const pool = quizPool(characters, contents, active, mode('quiz').quiz!);
        const bySeries = new Map(contents.map((content) => [content.id, content.series]));
        expect(pool.some((question) => bySeries.get(question.id) === off)).toBe(false);
        for (const question of pool) {
          expect(exclusiveTo(byId.get(question.correct)!, off), `${question.id}: respuesta`).toBe(false);
          expect(question.distractors.some((id) => exclusiveTo(byId.get(id)!, off)), `${question.id}: opciones`).toBe(false);
        }
      });

      it('ningún valor visible del Clásico es de la serie: ni sus transformaciones, ni su debut', () => {
        const columns = visibleColumns(mode('clasico').classic!.columns, active);
        const pool = eligibleEntities(characters, active);
        const answer = pool[0];
        const sagaNames = new Set(sagasJson.sagas.filter((saga) => saga.series === off).map((saga) => sagaLabels[saga.id]));
        for (const guess of pool) {
          const row = buildRow(guess, answer, columns, active);
          for (const cell of row.cells) {
            const text = cellText(cell.column, cell.value) ?? '';
            if (cell.column.key === 'transformaciones') {
              // Solo las formas de las series activas; las de la serie apagada ni se ven ni se comparan.
              const visible = (guess.attrs.transformaciones as Array<{ value: string; series: string }>)
                .filter((item) => active.includes(item.series))
                .map((item) => item.value);
              expect(cell.value, guess.id).toEqual(visible);
            }
            if (cell.column.key === 'sagaDebut') expect(sagaNames.has(text), `${guess.id}: ${text}`).toBe(false);
          }
        }
      });

      it('si el debut de un personaje fue en la serie apagada, su saga de debut se oculta', () => {
        const columns = visibleColumns(mode('clasico').classic!.columns, active);
        const pool = eligibleEntities(characters, active);
        const debuted = pool.filter((entity) => entity.series[0] === off);
        for (const guess of debuted) {
          const row = buildRow(guess, pool[0], columns, active);
          const cell = row.cells.find((candidate) => candidate.column.key === 'sagaDebut')!;
          expect(cell.hidden, `${guess.id}.sagaDebut`).toBe(true);
          expect(cell.value).toBeNull();
        }
      });

      it('ninguna frase, suceso ni técnica de la serie sale en su modo', () => {
        const quotes = textCandidates(characters, contents, active, quoteConfig);
        expect(quotes.flatMap((candidate) => candidate.contents).some((content) => content.series === off)).toBe(false);

        const techniques = imageCandidates(characters, contents, active, techniqueConfig);
        expect(techniques.flatMap((candidate) => candidate.images).every((image) => !image.id.includes(`:${off}`))).toBe(true);

        const pool = timelinePool(contents, active, timelineConfig);
        const bySeries = new Map(contents.map((content) => [content.id, content.series]));
        expect(pool.some((item) => bySeries.get(item.id) === off)).toBe(false);
        // Y tampoco en los retos que se arman de ese pool, día tras día.
        if (pool.length >= countOf(timelineConfig)) {
          for (let day = 0; day < 100; day++) {
            const puzzle = buildPuzzle(pool, { ...ctx, mode: 'linea-de-tiempo', day }, countOf(timelineConfig));
            expect(puzzle?.solution.some((item) => bySeries.get(item.id) === off), `día ${day}`).toBe(false);
          }
        }
      });

      it('en Conexiones no sale ningún grupo ni personaje exclusivo de la serie', () => {
        const pool = connectionsPool(characters, contents, active, mode('conexiones').connections!);
        const bySeries = new Map(contents.map((content) => [content.id, content.series]));
        expect(pool.some((group) => bySeries.get(group.id) === off)).toBe(false);
        const byId = new Map(characters.map((entity) => [entity.id, entity]));
        for (const group of pool) expect(group.available.some((id) => exclusiveTo(byId.get(id)!, off)), group.id).toBe(false);
        if (pool.length >= defaultMinPool('connections')) {
          for (let day = 0; day < 60; day++) {
            const board = buildBoard(pool, { ...ctx, mode: 'conexiones', filterKey: active.join('.'), day });
            for (const id of board?.groups.flatMap((group) => group.members) ?? []) expect(exclusiveTo(byId.get(id)!, off), `día ${day}: ${id}`).toBe(false);
          }
        }
      });
    });
  }
});

describe('contenido verificado', () => {
  const quotes = contents.filter((content) => content.kind === 'quote');
  const events = contents.filter((content) => content.kind === 'event');

  it('revela primero el destinatario y luego la raza', () => {
    expect(mode('frase').textClue!.lines.slice(1)).toEqual([
      { kind: 'content', label: 'Dicha a', after: 3, field: 'addressee' },
      { kind: 'attr', label: 'Raza', after: 6, keys: ['razas'] },
    ]);
    expect(quotes.find(({ id }) => id === 'quote-vegeta-2')?.payload.addressee).toBe('Nappa');
    expect(quotes.find(({ id }) => id === 'quote-freezer-6')?.payload.addressee).toBe('Destinatario no identificado');
    expect(quotes.find(({ id }) => id === 'quote-dyspo-1')?.payload.addressee).toBe('Destinatario no identificado');
    expect(quotes.find(({ id }) => id === 'quote-trunks-nino-1')?.entityId).toBe('trunks');
    expect(quotes.find(({ id }) => id === 'quote-trunks-del-futuro-2')?.entityId).toBe('trunks-del-futuro');
  });

  it('el filtro general de publicación conserva la verificación de frases y eventos', () => {
    const publishable = publishableContents(rawContents);
    const textPool = textCandidates(characters, publishable, allSeries, mode('frase').textClue!);
    const timeline = timelinePool(publishable, allSeries, mode('linea-de-tiempo').timeline!);
    const verifiedQuotes = rawContents.filter((content) => content.kind === 'quote' && content.verified).length;
    const verifiedEvents = rawContents.filter((content) => content.kind === 'event' && content.verified).length;
    // Mientras no haya verificadas, los pools están vacíos; con algunas, nunca tienen más de las verificadas.
    expect(textPool.flatMap((candidate) => candidate.contents)).toHaveLength(verifiedQuotes);
    expect(timeline).toHaveLength(verifiedEvents);
  });

  it('con todas verificadas hay frases y sucesos de sobra para jugar con todas las series', () => {
    expect(hasMinimumPool(textCandidates(characters, contents, allSeries, mode('frase').textClue!).length, defaultMinPool('text-clue'))).toBe(true);
    expect(hasMinimumPool(timelinePool(contents, allSeries, mode('linea-de-tiempo').timeline!).length, defaultMinPool('timeline'))).toBe(true);
    expect(quotes.length).toBeGreaterThan(40);
    expect(events.length).toBeGreaterThan(40);
  });
});

describe('Silueta', () => {
  it('solo las imágenes de fondo transparente pueden ser la respuesta; las demás se pueden intentar', () => {
    const config = mode('silueta').imageReveal!;
    const candidates = imageCandidates(characters, contents, allSeries, config);
    expect(candidates.length).toBeGreaterThanOrEqual(10);
    for (const candidate of candidates) expect(candidate.entity.attrs.imagenTransparente, candidate.id).toBe(1);
    const opaque = characters.filter((entity) => entity.attrs.imagenTransparente === 0);
    expect(opaque.length).toBeGreaterThan(0);
    for (const entity of opaque) expect(candidates.some((candidate) => candidate.id === entity.id), entity.id).toBe(false);
    expect(eligibleEntities(characters, allSeries)).toHaveLength(characters.length);
  });

  it('es un solo modo: el zoom sobre la sombra del personaje, sin un Zoom aparte', () => {
    expect(mode('silueta').imageReveal?.variant).toBe('zoom-silhouette');
    expect(modes.some((candidate) => candidate.slug === 'zoom')).toBe(false);
  });

  it('Dragon Ball ya no tiene el modo Borroso', () => {
    expect(modes.some((candidate) => candidate.slug === 'borroso')).toBe(false);
  });
});

describe('Conexiones', () => {
  const config = () => mode('conexiones').connections!;
  const groups = rawContents.filter((content) => content.kind === 'group');
  const fullMembers = new Map(groups.map((content) => [content.id, new Set(content.payload.members as string[])]));

  /** El tablero de un día con una combinación de series, y comprobaciones que valen para cualquiera. */
  function expectUniqueSolution(active: readonly string[], days: number) {
    const pool = connectionsPool(characters, contents, active, config());
    expect(pool.length, active.join('.')).toBeGreaterThanOrEqual(defaultMinPool('connections'));
    const filterKey = active.join('.');
    for (let day = 0; day < days; day++) {
      const board = buildBoard(pool, { franchise: 'dragon-ball', mode: 'conexiones', filterKey, day });
      expect(board, `${filterKey} día ${day}`).not.toBeNull();
      const members = board!.groups.flatMap((group) => group.members);
      expect(board!.groups.map((group) => group.difficulty), `${filterKey} día ${day}`).toEqual([1, 2, 3, 4]);
      expect(members, `${filterKey} día ${day}`).toHaveLength(4 * GROUP_SIZE);
      expect(new Set(members).size, `${filterKey} día ${day}: repetidos`).toBe(members.length);
      expect(new Set(members.map((id) => nameOf.get(id))).size, `${filterKey} día ${day}: nombres repetidos`).toBe(members.length);
      // Solución única: con la lista COMPLETA de miembros de cada grupo elegido, cada personaje del tablero está en uno solo.
      for (const group of board!.groups) {
        expect(group.members).toHaveLength(GROUP_SIZE);
        for (const id of group.members) {
          const owners = board!.groups.filter((other) => fullMembers.get(other.id)?.has(id)).map((other) => other.id);
          expect(owners, `${filterKey} día ${day}: ${id}`).toEqual([group.id]);
        }
      }
    }
  }

  it('el JSON de conexiones trae grupos de las cuatro dificultades, con ids únicos y al menos 4 miembros', () => {
    expect(groups.length).toBeGreaterThanOrEqual(30);
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
    for (const level of [1, 2, 3, 4]) expect(groups.some((group) => group.payload.difficulty === level), `dificultad ${level}`).toBe(true);
    for (const group of groups) {
      expect((group.payload.members as string[]).length, group.id).toBeGreaterThanOrEqual(GROUP_SIZE);
      expect(new Set(group.payload.members as string[]).size, `${group.id}: repetidos`).toBe((group.payload.members as string[]).length);
    }
  });

  it('cada miembro de cada grupo es un personaje que existe', () => {
    const known = new Set(characters.map((entity) => entity.id));
    for (const [id, members] of fullMembers) for (const member of members) expect(known.has(member), `${id}.${member}`).toBe(true);
  });

  // Medido en el navegador a 360 px (casilla de 71 px, Rubik de 12 px con -0,03 em, ver Games.module.scss): hasta 10 letras entran.
  it('ninguna palabra de un personaje es tan larga como para partirse en la grilla de 4 columnas a 360 px', () => {
    for (const group of groups) {
      for (const id of group.payload.members as string[]) {
        for (const word of (nameOf.get(id) ?? '').split(/\s+/)) expect(word.length, `${group.id}.${id}: ${word}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('en 500 días simulados con todas las series, todos los tableros tienen solución única', () => {
    expectUniqueSolution(allSeries, 500);
  });

  it('también con cada combinación de series que tiene pool suficiente', () => {
    let checked = 0;
    for (const active of combinations) {
      if (connectionsPool(characters, contents, active, config()).length < defaultMinPool('connections')) continue;
      expectUniqueSolution(active, 100);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  });

  it('hay grupos de sobra para al menos 30 tableros distintos con todas las series', () => {
    const pool = connectionsPool(characters, contents, allSeries, config());
    const boards = new Set<string>();
    for (let day = 0; day < 500; day++) {
      const board = buildBoard(pool, { franchise: 'dragon-ball', mode: 'conexiones', filterKey: 'all', day })!;
      boards.add(board.groups.map((group) => `${group.id}:${group.members.join(',')}`).join('|'));
    }
    expect(boards.size).toBeGreaterThanOrEqual(30);
  });

  it('es el mismo tablero para quien tenga los mismos filtros, y otro con otros filtros', () => {
    const pool = connectionsPool(characters, contents, allSeries, config());
    const day = { franchise: 'dragon-ball', mode: 'conexiones', filterKey: 'all', day: 321 };
    const board = JSON.stringify(buildBoard(pool, day));
    expect(JSON.stringify(buildBoard([...pool].reverse(), day))).toBe(board);
    expect(JSON.stringify(buildBoard(pool, { ...day, filterKey: 'dbz.super' }))).not.toBe(board);
  });
});

describe('Quiz', () => {
  const config = () => mode('quiz').quiz!;
  const questions = rawContents.filter((content) => content.kind === 'question');
  type Payload = { question: string; correct: string; distractors: string[]; explanation: string };

  it('el JSON trae 127 preguntas con ids consecutivos y personajes que existen', () => {
    expect(questions).toHaveLength(127);
    expect(questions.map((question) => question.id)).toEqual(Array.from({ length: 127 }, (_, index) => `question-q-${String(index + 1).padStart(3, '0')}`));
    for (const question of questions) {
      const { correct, distractors } = question.payload as Payload;
      expect(allSeries, question.id).toContain(question.series);
      expect(byId.has(correct), `${question.id}: ${correct}`).toBe(true);
      expect(distractors, question.id).toHaveLength(11);
      expect(new Set(distractors).size, `${question.id}: distractores repetidos`).toBe(11);
      expect(distractors, question.id).not.toContain(correct);
      for (const id of distractors) expect(byId.has(id), `${question.id}: ${id}`).toBe(true);
    }
  });

  it('la pregunta no nombra a la respuesta y cada una tiene dato y fuente', () => {
    for (const question of questions) {
      const { question: text, correct, explanation } = question.payload as Payload;
      expect(text.toLowerCase(), question.id).not.toContain(nameOf.get(correct)!.toLowerCase());
      expect(explanation.length, question.id).toBeGreaterThan(10);
    }
    // La página donde se verificó cada dato está en el archivo de datos y no entra a los créditos (no es texto copiado).
    for (const question of quizSource) expect(question.source, question.id).toMatch(/^https?:\/\//);
    expect(questions.some((question) => 'source' in question.payload)).toBe(false);
  });

  it('ninguna respuesta se repite más de dos veces en todo el set', () => {
    const counts = new Map<string, number>();
    for (const question of questions) counts.set((question.payload as Payload).correct, (counts.get((question.payload as Payload).correct) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it('con todas las series y todas las preguntas disponibles hay 127, y con cualquier combinación alcanza el mínimo para jugar', () => {
    expect(quizPool(characters, contents, allSeries, config())).toHaveLength(127);
    for (const active of combinations) {
      expect(quizPool(characters, contents, active, config()).length, active.join('.')).toBeGreaterThanOrEqual(defaultMinPool('quiz'));
    }
  });

  it('cada día trae una pregunta con 12 opciones distintas, la correcta entre ellas', () => {
    const pool = quizPool(characters, contents, allSeries, config());
    for (const day of [0, 1, 7, 99, 321]) {
      const dayCtx = { franchise: 'dragon-ball', mode: 'quiz', filterKey: 'all', day };
      const question = questionOf(pool, dayCtx)!;
      expect(question, `día ${day}`).not.toBeNull();
      const options = optionsFor(question, optionCountOf(config()), dayCtx);
      expect(options, question.id).toHaveLength(12);
      expect(new Set(options).size, question.id).toBe(12);
      expect(options.filter((id) => id === question.correct), question.id).toHaveLength(1);
      for (const id of options) expect(byId.has(id), id).toBe(true);
    }
  });

  it('con todas las series no se repite ninguna pregunta en 127 días seguidos', () => {
    const pool = quizPool(characters, contents, allSeries, config());
    for (let start = 0; start < 381; start += 127) {
      const seen = new Set<string>();
      for (let day = start; day < start + 127; day++) {
        const question = questionOf(pool, { franchise: 'dragon-ball', mode: 'quiz', filterKey: 'all', day })!;
        expect(seen.has(question.id), `día ${day}: ${question.id}`).toBe(false);
        seen.add(question.id);
      }
      expect(seen.size).toBe(127);
    }
  });

  it('es la misma pregunta para quien tenga los mismos filtros, sin importar el orden de los datos, y otra con otros filtros', () => {
    const pool = quizPool(characters, contents, allSeries, config());
    const day = { franchise: 'dragon-ball', mode: 'quiz', filterKey: 'all', day: 321 };
    const asked = questionOf(pool, day)!.id;
    expect(questionOf([...pool].reverse(), day)!.id).toBe(asked);
    const others = ['dbz', 'all~x', 'all~a', 'db.super'].map((filterKey) => questionOf(pool, { ...day, filterKey })!.id);
    expect(others.some((id) => id !== asked)).toBe(true);
  });

  it('cada combinación de series arma una pregunta de sus series', () => {
    const bySeries = new Map(contents.map((content) => [content.id, content.series]));
    for (const active of combinations) {
      const filterKey = active.join('.');
      const pool = quizPool(characters, contents, active, config());
      expect(pool.length, filterKey).toBeGreaterThan(0);
      for (const day of [0, 5, 40]) {
        const question = questionOf(pool, { franchise: 'dragon-ball', mode: 'quiz', filterKey, day })!;
        expect(question, `${filterKey} día ${day}`).not.toBeNull();
        expect(active, `${filterKey}: ${question.id}`).toContain(bySeries.get(question.id));
      }
    }
  });
});

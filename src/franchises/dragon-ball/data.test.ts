// Pruebas sobre los datos reales de Dragon Ball (data/dragon-ball/) y su config: lo que los tests
// de la lógica no pueden ver. La regla central de la SPEC: lo que se apaga no aparece nunca. Con
// cada serie apagada, ninguna entidad, forma, frase ni suceso suyo sale como respuesta, como opción
// ni como valor visible en ninguno de los modos.

import { beforeAll, describe, expect, it } from 'vitest';
import { yesterday as yesterdayOf, type DailyContext } from '@/engine/daily';
import { defaultMinPool, eligibleEntities, hasMinimumPool, publishableContents } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { buildRow, cellText, visibleColumns } from '@/modes/classic/logic';
import { MAX_ROUNDS, buildRounds, metricOfDay, poolOf as higherLowerPool } from '@/modes/higher-lower/logic';
import { candidatesOf as imageCandidates } from '@/modes/image-reveal/logic';
import { candidatesOf as textCandidates } from '@/modes/text-clue/logic';
import { buildPuzzle, countOf, poolOf as timelinePool } from '@/modes/timeline/logic';
import { modeStatus } from '@/app/[franchise]/[mode]/playable';
import contentJson from '../../../data/dragon-ball/content.json';
import entitiesJson from '../../../data/dragon-ball/entities.json';
import formsJson from '../../../data/dragon-ball/transformations.json';
import sagasJson from '../../../data/dragon-ball/sagas.json';
import { entitiesOfMode, loadFranchiseData, type FranchiseData } from '../data';
import type { ModeConfig } from '../types';
import { dragonBallConfig, sagaLabels } from './config';

const characters = entitiesJson as Entity[];
const forms = formsJson as Entity[];
const rawContents = contentJson as Content[];
// Todas las frases y sucesos están sin verificar hasta que alguien los revise a mano (verified: false en data-src).
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
const ctx: DailyContext = { franchise: 'dragon-ball', mode: 'x', filterKey: 'all', day: 200 };

describe('config', () => {
  it('tiene los 9 modos de la SPEC, en orden y con su motor', () => {
    expect(modes.map((m) => [m.slug, m.engine])).toEqual([
      ['clasico', 'classic'],
      ['silueta', 'image-reveal'],
      ['frase', 'text-clue'],
      ['borroso', 'image-reveal'],
      ['tecnica', 'image-reveal'],
      ['zoom', 'image-reveal'],
      ['poder', 'higher-lower'],
      ['transformacion', 'image-reveal'],
      ['linea-de-tiempo', 'timeline'],
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

  it('las columnas de serie y saga de debut tienen nombre para cada número que aparece en los datos', () => {
    const columns = Object.fromEntries((mode('clasico').classic?.columns ?? []).map((column) => [column.key, column]));
    for (const key of ['serieDebut', 'sagaDebut']) {
      const labels = columns[key]?.valueLabels;
      expect(labels, key).toBeDefined();
      for (const entity of characters) {
        expect(labels?.[String(entity.attrs[key])], `${entity.id}.${key}=${String(entity.attrs[key])}`).toBeDefined();
      }
    }
  });

  it('cada número de saga se muestra con el nombre corto de su saga y la serie a la que pertenece', () => {
    const labels = mode('clasico').classic?.columns.find((column) => column.key === 'sagaDebut')?.valueLabels ?? {};
    for (const saga of sagasJson.sagas) {
      expect(sagaLabels[saga.id], `falta el nombre corto de ${saga.id}`).toBeDefined();
      expect(labels[String(saga.order)]).toEqual({ label: sagaLabels[saga.id], series: saga.series });
    }
  });

  it('el modo Transformación adivina las formas, no los personajes', () => {
    expect(mode('transformacion').entitySet).toBe('transformations');
    for (const other of modes.filter((candidate) => candidate.slug !== 'transformacion')) expect(other.entitySet, other.slug).toBeUndefined();
  });
});

describe('carga de datos', () => {
  let data: FranchiseData;
  beforeAll(async () => {
    data = (await loadFranchiseData('dragon-ball')) as FranchiseData;
  });

  it('trae los personajes, las formas como conjunto aparte y el contenido', () => {
    expect(data.entities).toHaveLength(characters.length);
    expect(entitiesOfMode(data, 'transformations')).toHaveLength(forms.length);
    expect(entitiesOfMode(data, undefined)).toBe(data.entities);
    // Con las frases y los sucesos sin verificar y sin imágenes de técnicas, hoy no queda contenido; nunca más del que hay.
    expect(data.contents.length).toBeLessThanOrEqual(rawContents.length);
  });

  it('las frases y los sucesos sin verificar no llegan a ningún pool', () => {
    const unverified = rawContents.filter((content) => content.kind === 'quote' || content.kind === 'event').filter((content) => !content.verified);
    const loaded = new Set(data.contents.map((content) => content.id));
    for (const content of unverified) expect(loaded.has(content.id), content.id).toBe(false);
    for (const content of data.contents.filter((candidate) => candidate.kind === 'quote' || candidate.kind === 'event')) expect(content.verified, content.id).toBe(true);
  });

  it('lo demás sí entra, esté o no verificado', () => {
    const others = rawContents.filter((content) => content.kind !== 'quote' && content.kind !== 'event');
    expect(publishableContents(rawContents).filter((content) => content.kind !== 'quote' && content.kind !== 'event')).toHaveLength(others.length);
  });

  it('los modos con contenido de sobra están disponibles; los demás dependen de lo que haya y se oculta el que no alcanza', () => {
    for (const slug of ['clasico', 'silueta', 'borroso', 'zoom', 'poder', 'transformacion']) {
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
        for (const slug of ['silueta', 'borroso', 'zoom']) {
          const candidates = imageCandidates(characters, contents, active, mode(slug).imageReveal!);
          expect(candidates.some((candidate) => exclusiveTo(candidate.entity, off)), slug).toBe(false);
        }
      });

      it('ninguna transformación de la serie es una respuesta ni una opción', () => {
        const options = eligibleEntities(forms, active);
        expect(options.some((form) => form.series.includes(off))).toBe(false);
        const candidates = imageCandidates(forms, contents, active, mode('transformacion').imageReveal!);
        expect(candidates.some((candidate) => candidate.entity.series.includes(off))).toBe(false);
      });

      it('ningún valor visible del Clásico es de la serie: ni sus transformaciones, ni su debut', () => {
        const columns = visibleColumns(mode('clasico').classic!.columns, active);
        const pool = eligibleEntities(characters, active);
        const answer = pool[0];
        const seriesName = dragonBallConfig.seriesLabels[off as keyof typeof dragonBallConfig.seriesLabels];
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
            if (cell.column.key === 'serieDebut') expect(text, guess.id).not.toBe(seriesName);
            if (cell.column.key === 'sagaDebut') expect(sagaNames.has(text), `${guess.id}: ${text}`).toBe(false);
          }
        }
      });

      it('si el debut de un personaje fue en la serie apagada, su serie y su saga de debut se ocultan', () => {
        const columns = visibleColumns(mode('clasico').classic!.columns, active);
        const pool = eligibleEntities(characters, active);
        const debuted = pool.filter((entity) => entity.series[0] === off);
        for (const guess of debuted) {
          const row = buildRow(guess, pool[0], columns, active);
          for (const key of ['serieDebut', 'sagaDebut']) {
            const cell = row.cells.find((candidate) => candidate.column.key === key)!;
            expect(cell.hidden, `${guess.id}.${key}`).toBe(true);
            expect(cell.value).toBeNull();
          }
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

      it('en Nivel de poder no sale ningún personaje exclusivo de la serie', () => {
        const metrics = mode('poder').higherLower!.metrics;
        const pool = higherLowerPool(characters, active, metrics);
        expect(pool.some((entity) => exclusiveTo(entity, off))).toBe(false);
        const rounds = buildRounds(pool, metricOfDay(metrics, 5).key, { ...ctx, mode: 'poder' }, MAX_ROUNDS, mode('poder').higherLower!.minRatio);
        for (const round of rounds) {
          expect(exclusiveTo(round.a, off) || exclusiveTo(round.b, off)).toBe(false);
        }
      });
    });
  }
});

describe('contenido verificado', () => {
  const quotes = contents.filter((content) => content.kind === 'quote');
  const events = contents.filter((content) => content.kind === 'event');

  it('sin verificar, un modo de frases o de sucesos no tiene pool: se oculta en vez de mostrar un juego vacío', () => {
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

  it('Borroso y Zoom aceptan también las imágenes con fondo', () => {
    const silhouette = imageCandidates(characters, contents, allSeries, mode('silueta').imageReveal!);
    for (const slug of ['borroso', 'zoom']) {
      const candidates = imageCandidates(characters, contents, allSeries, mode(slug).imageReveal!);
      expect(candidates.length, slug).toBeGreaterThan(silhouette.length);
    }
  });
});

describe('Transformación', () => {
  it('las respuestas son las formas, y los personajes no se pueden elegir', () => {
    const candidates = imageCandidates(forms, contents, allSeries, mode('transformacion').imageReveal!);
    expect(candidates.length).toBe(forms.filter((form) => form.image !== undefined).length);
    const formIds = new Set(forms.map((form) => form.id));
    for (const candidate of candidates) expect(formIds.has(candidate.id)).toBe(true);
    for (const character of characters) expect(formIds.has(character.id), character.id).toBe(false);
  });

  it('la respuesta de ayer es una forma', () => {
    const candidates = imageCandidates(forms, contents, allSeries, mode('transformacion').imageReveal!);
    const answer = yesterdayOf(candidates, ctx);
    expect(forms.some((form) => form.id === answer.id)).toBe(true);
  });
});

describe('Nivel de poder', () => {
  const higherLower = () => mode('poder').higherLower!;

  it('tiene al menos 10 personajes con ki y todos los valores son positivos', () => {
    const pool = higherLowerPool(characters, allSeries, higherLower().metrics);
    expect(hasMinimumPool(pool.length, defaultMinPool('higher-lower'))).toBe(true);
    for (const entity of pool) expect(entity.attrs.ki as number, entity.id).toBeGreaterThan(0);
  });

  it('solo ofrece pares con al menos un orden de magnitud de diferencia, todos los días', () => {
    const metrics = higherLower().metrics;
    const pool = higherLowerPool(characters, allSeries, metrics);
    let total = 0;
    for (let day = 0; day < 60; day++) {
      const rounds = buildRounds(pool, metricOfDay(metrics, day).key, { ...ctx, mode: 'poder', day }, MAX_ROUNDS, higherLower().minRatio);
      expect(rounds.length, `día ${day}`).toBeGreaterThan(10);
      for (const round of rounds) {
        total++;
        expect(Math.max(round.aValue, round.bValue) / Math.min(round.aValue, round.bValue), `${round.a.id} vs ${round.b.id}`).toBeGreaterThanOrEqual(10);
      }
    }
    expect(total).toBeGreaterThan(600);
  });

  it('la secuencia es la misma para quien tenga los mismos filtros', () => {
    const metrics = higherLower().metrics;
    const pool = higherLowerPool(characters, allSeries, metrics);
    const ids = () => buildRounds(pool, 'ki', { ...ctx, mode: 'poder' }, MAX_ROUNDS, 10).map((round) => `${round.a.id}|${round.b.id}`);
    expect(ids()).toEqual(ids());
  });
});

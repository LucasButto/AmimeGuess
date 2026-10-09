// Pruebas sobre los datos reales de Yu-Gi-Oh (data/yugioh/) y su config: lo que los tests de la lógica no
// pueden ver. Yu-Gi-Oh es la única franquicia con dos clases de entidad: los duelistas (las principales) y
// las cartas insignia (el conjunto `cards`). La regla central de la SPEC: lo que se apaga no aparece nunca.
// Con cada serie apagada, ningún duelista ni carta suyos sale como respuesta, como opción ni como valor
// visible en ninguno de los 10 modos.

import { beforeAll, describe, expect, it } from 'vitest';
import { modeStatus } from '@/app/[franchise]/[mode]/playable';
import { buildSearchIndex, search } from '@/components/search';
import type { DailyContext } from '@/engine/daily';
import { defaultMinPool, eligibleEntities, hasMinimumPool } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { buildRow, cellText, hintText, visibleColumns } from '@/modes/classic/logic';
import { MAX_ROUNDS, buildRounds, metricOfDay, poolOf as higherLowerPool } from '@/modes/higher-lower/logic';
import { candidatesOf as imageCandidates } from '@/modes/image-reveal/logic';
import { candidatesOf as listCandidates, itemsOf } from '@/modes/reveal-list/logic';
import { candidatesOf as textCandidates, lineStates } from '@/modes/text-clue/logic';
import cardsJson from '../../../data/yugioh/cards.json';
import contentJson from '../../../data/yugioh/content.json';
import entitiesJson from '../../../data/yugioh/entities.json';
import seriesJson from '../../../data/yugioh/series.json';
import { entitiesOfMode, loadFranchiseData, type FranchiseData } from '../data';
import { modePoolSize } from '../pool';
import type { ModeConfig } from '../types';
import { yugiohConfig } from './config';

const duelists = entitiesJson as Entity[];
const cards = cardsJson as Entity[];
const rawContents = contentJson as Content[];
const modes: readonly ModeConfig[] = yugiohConfig.modes;
const allSeries: readonly string[] = yugiohConfig.series;

const mode = (slug: string): ModeConfig => {
  const found = modes.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`No existe el modo ${slug}`);
  return found;
};

const exclusiveTo = (entity: Pick<Entity, 'series'>, series: string) => entity.series.length === 1 && entity.series[0] === series;
const without = (series: string) => allSeries.filter((id) => id !== series);
const ctx: DailyContext = { franchise: 'yugioh', mode: 'x', filterKey: 'all', day: 200 };
const nameOf = (id: string) => yugiohConfig.seriesLabels[id as keyof typeof yugiohConfig.seriesLabels];

/** Los modos que adivinan una carta y los que adivinan un duelista. */
const CARD_MODES = ['carta', 'silueta', 'texto', 'arte', 'zoom', 'mayor-o-menor', 'invocacion'];
const DUELIST_MODES = ['duelista', 'carta-insignia', 'deck'];

/**
 * Invocaciones cuyo material es una carta de otra serie. VWXYZ-Dragon Catapult Cannon (Chazz, GX) se fusiona con
 * XYZ-Dragon Cannon (Kaiba, Duel Monsters): con Duel Monsters apagado, la lista de materiales nombra esa carta, igual
 * que el texto oficial de otras cartas nombra a una carta de otra serie. Es el único caso; cualquier otro es un error.
 */
const SUMMONS_WITH_OTHER_SERIES_MATERIAL: Readonly<Record<string, string[]>> = {
  dm: ['summon-vwxyz-dragon-catapult-cannon-gx'],
};

describe('config', () => {
  it('tiene los 10 modos de la SPEC, en orden y con su motor, y Duelista es el principal (el primero)', () => {
    expect(modes.map((m) => [m.slug, m.engine])).toEqual([
      ['duelista', 'classic'],
      ['carta', 'classic'],
      ['silueta', 'image-reveal'],
      ['texto', 'text-clue'],
      ['arte', 'image-reveal'],
      ['carta-insignia', 'image-reveal'],
      ['zoom', 'image-reveal'],
      ['mayor-o-menor', 'higher-lower'],
      ['invocacion', 'reveal-list'],
      ['deck', 'reveal-list'],
    ]);
    expect(modes[0].slug).toBe('duelista');
  });

  it('cada modo trae la configuración de su motor', () => {
    for (const m of modes) {
      const config = {
        classic: m.classic,
        'image-reveal': m.imageReveal,
        'text-clue': m.textClue,
        'reveal-list': m.revealList,
        'higher-lower': m.higherLower,
      }[m.engine as string];
      expect(config, m.slug).toBeDefined();
    }
  });

  it('solo Duel Monsters, GX y 5D\'s: las series de la config son las de los datos y las que tienen nombre', () => {
    expect(allSeries).toEqual(['dm', 'gx', '5ds']);
    expect(Object.keys(yugiohConfig.seriesLabels)).toEqual([...allSeries]);
    const used = new Set([...duelists, ...cards].flatMap((entity) => entity.series));
    expect([...used].sort()).toEqual([...allSeries].sort());
    for (const content of rawContents) expect(allSeries.includes(content.series), content.id).toBe(true);
    // El orden canónico de la clave de filtro es el de series.json; las que se sumen después van al final.
    expect(seriesJson.series.map((entry) => entry.id).slice(0, allSeries.length)).toEqual([...allSeries]);
  });

  it('los modos de cartas usan el conjunto `cards`; Duelista, Carta insignia y Deck, los duelistas', () => {
    for (const slug of CARD_MODES) expect(mode(slug).entitySet, slug).toBe('cards');
    for (const slug of DUELIST_MODES) expect(mode(slug).entitySet, slug).toBeUndefined();
  });

  it('las columnas y las pistas del Clásico existen en todos los duelistas y en todas las cartas', () => {
    for (const [slug, entities] of [
      ['duelista', duelists],
      ['carta', cards],
    ] as const) {
      const classic = mode(slug).classic;
      for (const column of classic?.columns ?? []) {
        for (const entity of entities) expect(column.key in entity.attrs, `${slug}: ${entity.id}.${column.key}`).toBe(true);
      }
      for (const hint of classic?.hints ?? []) {
        if (hint.kind === 'attr') for (const entity of entities) expect(hint.key in entity.attrs, `${slug}: ${entity.id}.${hint.key}`).toBe(true);
      }
    }
    expect(mode('duelista').classic?.columns).toHaveLength(6);
    expect(mode('carta').classic?.columns).toHaveLength(8);
  });

  it('la serie de debut se muestra con el nombre de la serie y es la primera serie del duelista', () => {
    const labels = mode('duelista').classic?.columns.find((column) => column.key === 'serieDebut')?.valueLabels ?? {};
    expect(Object.keys(labels)).toEqual(['1', '2', '3']);
    for (const entry of seriesJson.series.filter((item) => allSeries.includes(item.id))) {
      expect(labels[String(entry.order)]).toEqual({ label: nameOf(entry.id), series: entry.id });
    }
    for (const duelist of duelists) {
      expect(labels[String(duelist.attrs.serieDebut)]?.series, duelist.id).toBe(duelist.series[0]);
    }
  });

  it('las pistas de texto, las listas y las métricas leen campos que existen en los datos', () => {
    const fields = (kind: string) => new Set(rawContents.filter((content) => content.kind === kind).flatMap((content) => Object.keys(content.payload)));
    const texto = mode('texto').textClue!;
    for (const line of texto.lines) {
      if (line.kind === 'content') expect(fields(texto.contentKind).has(line.field), line.field).toBe(true);
      else for (const key of line.keys) expect(key in cards[0].attrs, key).toBe(true);
    }
    for (const slug of ['invocacion', 'deck']) {
      const list = mode(slug).revealList!;
      expect(fields(list.contentKind).has(list.field), slug).toBe(true);
    }
    for (const hint of mode('carta').classic!.hints) {
      if (hint.kind === 'content') expect(fields(hint.contentKind).has(hint.field), hint.field).toBe(true);
    }
    const aceKind = mode('carta-insignia').imageReveal!.imageContentKind!;
    expect(fields(aceKind).has('image')).toBe(true);
    for (const metric of mode('mayor-o-menor').higherLower!.metrics) expect(metric.key in cards[0].attrs, metric.key).toBe(true);
  });
});

describe('carga de datos', () => {
  let data: FranchiseData;
  beforeAll(async () => {
    data = (await loadFranchiseData('yugioh')) as FranchiseData;
  });

  it('trae los duelistas como entidades principales y las cartas como conjunto aparte', () => {
    expect(data.entities).toHaveLength(duelists.length);
    expect(data.entitySets?.cards).toHaveLength(cards.length);
    expect(Object.keys(data.entitySets ?? {})).toEqual(['cards']);
    // Texto, deck, invocación y carta as no son de los tipos que piden verificación para entrar a un pool.
    expect(data.contents).toHaveLength(rawContents.length);
  });

  it('cada modo recibe el tipo de entidad que le corresponde', () => {
    for (const slug of DUELIST_MODES) {
      const entities = entitiesOfMode(data, mode(slug).entitySet);
      expect(entities, slug).toBe(data.entities);
      for (const entity of entities) expect('rol' in entity.attrs, `${slug}: ${entity.id}`).toBe(true);
    }
    for (const slug of CARD_MODES) {
      const entities = entitiesOfMode(data, mode(slug).entitySet);
      expect(entities, slug).toBe(data.entitySets?.cards);
      for (const entity of entities) expect('clase' in entity.attrs, `${slug}: ${entity.id}`).toBe(true);
    }
  });

  it('los 10 modos están disponibles con todas las series', () => {
    for (const m of modes) expect(modeStatus(yugiohConfig, m, data), m.slug).toBe('playable');
  });

  it('con todas las series, cada modo alcanza su pool mínimo', () => {
    for (const m of modes) {
      const size = modePoolSize(m, data, allSeries);
      expect(size, m.slug).not.toBeNull();
      expect(hasMinimumPool(size!, defaultMinPool(m.engine)), `${m.slug}: ${size}`).toBe(true);
    }
  });

  it('el pool de cada modo cuenta entidades respuesta: duelistas en los de duelista, cartas en los de carta', () => {
    expect(modePoolSize(mode('duelista'), data, allSeries)).toBe(duelists.length);
    expect(modePoolSize(mode('carta-insignia'), data, allSeries)).toBe(duelists.length);
    expect(modePoolSize(mode('deck'), data, allSeries)).toBe(duelists.length);
    expect(modePoolSize(mode('carta'), data, allSeries)).toBe(cards.length);
    expect(modePoolSize(mode('arte'), data, allSeries)).toBe(cards.length);
    expect(modePoolSize(mode('zoom'), data, allSeries)).toBe(cards.length);
  });
});

describe('autocompletado', () => {
  const index = (entities: readonly Entity[]) =>
    buildSearchIndex(entities.map((entity) => ({ id: entity.id, label: entity.name.es, aliases: entity.aliases })));

  it('cada carta se encuentra escribiendo su nombre en español o en inglés', () => {
    const cardIndex = index(cards);
    for (const card of cards) {
      expect(search(cardIndex, card.name.es).some((found) => found.id === card.id), `${card.id} (es)`).toBe(true);
      expect(search(cardIndex, card.name.en ?? card.name.es).some((found) => found.id === card.id), `${card.id} (en)`).toBe(true);
    }
  });

  it('cada duelista se encuentra por su nombre, y solo ofrece duelistas', () => {
    const duelistIndex = index(duelists);
    for (const duelist of duelists) {
      expect(search(duelistIndex, duelist.name.es).some((found) => found.id === duelist.id), duelist.id).toBe(true);
    }
    const cardIds = new Set(cards.map((card) => card.id));
    for (const found of search(duelistIndex, 'a')) expect(cardIds.has(found.id), found.id).toBe(false);
  });
});

describe('con una serie apagada no aparece nada de ella', () => {
  const imageModes = ['arte', 'zoom', 'carta-insignia', 'silueta'] as const;
  const poolOf = (slug: string) => entitiesOfMode({ entities: duelists, contents: rawContents, entitySets: { cards } }, mode(slug).entitySet);

  for (const off of allSeries) {
    describe(`sin ${off}`, () => {
      const active = without(off);

      it('ningún duelista exclusivo de la serie es una opción ni una respuesta, en ningún modo de duelista', () => {
        expect(eligibleEntities(duelists, active).some((entity) => exclusiveTo(entity, off))).toBe(false);
        const image = imageCandidates(poolOf('carta-insignia'), rawContents, active, mode('carta-insignia').imageReveal!);
        const deck = listCandidates(poolOf('deck'), rawContents, active, mode('deck').revealList!);
        expect(image.length).toBeGreaterThan(0);
        expect(deck.length).toBeGreaterThan(0);
        for (const candidate of [...image, ...deck]) expect(exclusiveTo(candidate.entity, off), candidate.id).toBe(false);
      });

      it('ninguna carta cuyos dueños sean todos de la serie es una opción ni una respuesta, en ningún modo de carta', () => {
        const options = eligibleEntities(cards, active);
        expect(options.some((entity) => exclusiveTo(entity, off))).toBe(false);
        expect(options.every((entity) => entity.series.some((id) => active.includes(id)))).toBe(true);
        for (const slug of imageModes.filter((item) => item !== 'carta-insignia')) {
          const candidates = imageCandidates(cards, rawContents, active, mode(slug).imageReveal!);
          expect(candidates.some((candidate) => exclusiveTo(candidate.entity, off)), slug).toBe(false);
        }
        const text = textCandidates(cards, rawContents, active, mode('texto').textClue!);
        const summons = listCandidates(cards, rawContents, active, mode('invocacion').revealList!);
        for (const candidate of [...text, ...summons]) expect(exclusiveTo(candidate.entity, off), candidate.id).toBe(false);
        const metrics = mode('mayor-o-menor').higherLower!.metrics;
        expect(higherLowerPool(cards, active, metrics).some((entity) => exclusiveTo(entity, off))).toBe(false);
      });

      it('ningún texto, deck, carta as ni invocación elegible es de la serie', () => {
        const text = textCandidates(cards, rawContents, active, mode('texto').textClue!);
        const decks = listCandidates(duelists, rawContents, active, mode('deck').revealList!);
        const summons = listCandidates(cards, rawContents, active, mode('invocacion').revealList!);
        for (const candidate of [...text, ...decks, ...summons]) {
          for (const content of candidate.contents) expect(content.series, content.id).not.toBe(off);
        }
        const seriesOf = new Map(rawContents.map((content) => [content.id, content.series]));
        for (const candidate of imageCandidates(duelists, rawContents, active, mode('carta-insignia').imageReveal!)) {
          for (const image of candidate.images) expect(seriesOf.get(image.id), image.id).not.toBe(off);
        }
        for (const candidate of imageCandidates(cards, rawContents, active, mode('silueta').imageReveal!)) {
          for (const image of candidate.images) expect(seriesOf.get(image.id), image.id).not.toBe(off);
        }
      });

      it('ningún valor visible del Clásico Carta nombra a un duelista ni a una serie de la apagada', () => {
        const columns = visibleColumns(mode('carta').classic!.columns, active);
        const pool = eligibleEntities(cards, active);
        const offNames = new Set(duelists.filter((entity) => exclusiveTo(entity, off)).map((entity) => entity.name.es));
        const answer = pool[0];
        for (const guess of pool) {
          const row = buildRow(guess, answer, columns, active);
          for (const cell of row.cells) {
            if (cell.column.key === 'duelistas') {
              const visible = (cell.value as string[]) ?? [];
              expect(visible.some((name) => offNames.has(name)), guess.id).toBe(false);
              expect(visible.length, guess.id).toBeGreaterThan(0);
            }
            if (cell.column.key === 'serie') expect(cellText(cell.column, cell.value) ?? '', guess.id).not.toContain(nameOf(off));
          }
        }
      });

      it('la serie de debut de cada duelista elegible es una serie activa: nunca se oculta ni nombra a la apagada', () => {
        const columns = visibleColumns(mode('duelista').classic!.columns, active);
        const pool = eligibleEntities(duelists, active);
        for (const guess of pool) {
          const cell = buildRow(guess, pool[0], columns, active).cells.find((candidate) => candidate.column.key === 'serieDebut')!;
          expect(cell.hidden, guess.id).toBeUndefined();
          expect(cellText(cell.column, cell.value), guess.id).not.toBe(nameOf(off));
        }
      });

      it('ningún deck nombra una carta exclusiva de la serie, y las invocaciones solo con las excepciones conocidas', () => {
        const names = new Set(cards.filter((card) => exclusiveTo(card, off)).map((card) => card.name.es));
        const decks = mode('deck').revealList!;
        for (const candidate of listCandidates(duelists, rawContents, active, decks)) {
          for (const content of candidate.contents) {
            for (const item of itemsOf(content, decks.field)) expect(names.has(item), `${content.id}: ${item}`).toBe(false);
          }
        }
        const summons = mode('invocacion').revealList!;
        const named: string[] = [];
        for (const candidate of listCandidates(cards, rawContents, active, summons)) {
          for (const content of candidate.contents) {
            if (itemsOf(content, summons.field).some((item) => names.has(item))) named.push(content.id);
          }
        }
        expect(named.sort()).toEqual(SUMMONS_WITH_OTHER_SERIES_MATERIAL[off] ?? []);
      });
    });
  }
});

describe('Duelista', () => {
  it('las pistas dan la primera aparición del duelista del día cuando se piden', () => {
    const hint = mode('duelista').classic!.hints[0];
    for (const duelist of duelists) {
      const text = hintText(hint, duelist, rawContents);
      expect(text, duelist.id).toMatch(/episodio/);
    }
  });

  it('con cualquier combinación de series, hasta con una sola (14 a 16 duelistas), el Clásico Duelista se puede jugar', () => {
    for (let mask = 1; mask < 2 ** allSeries.length; mask++) {
      const active = allSeries.filter((_, index) => (mask >> index) & 1);
      const size = eligibleEntities(duelists, active).length;
      expect(hasMinimumPool(size, defaultMinPool('classic')), `${active.join('.')}: ${size}`).toBe(true);
    }
  });
});

describe('Carta', () => {
  it('la pista es el texto oficial de la carta, y existe para casi todas', () => {
    const hint = mode('carta').classic!.hints[0];
    const withText = cards.filter((card) => hintText(hint, card, rawContents) !== null);
    expect(withText.length).toBeGreaterThan(cards.length - 20);
    // Las que no la tienen son las 9 sin texto en español de YGOResources.
    expect(cards.length - withText.length).toBe(cards.filter((card) => !rawContents.some((content) => content.kind === 'card-text' && content.entityId === card.id)).length);
  });
});

describe('Silueta', () => {
  it('solo los monstruos con un recorte que sirvió pueden ser la respuesta, y cada uno tiene su imagen', () => {
    const candidates = imageCandidates(cards, rawContents, allSeries, mode('silueta').imageReveal!);
    expect(candidates.length).toBeGreaterThanOrEqual(defaultMinPool('image-reveal'));
    for (const candidate of candidates) {
      expect(String(candidate.entity.attrs.clase), candidate.id).toMatch(/^Monstruo/);
      expect(candidate.images.length, candidate.id).toBeGreaterThan(0);
      for (const image of candidate.images) expect(image.stem, candidate.id).toBe(`yugioh/silhouettes/${candidate.id}`);
    }
  });

  it('una magia o una trampa sigue siendo una opción del autocompletado pero no una respuesta', () => {
    const candidates = new Set(imageCandidates(cards, rawContents, allSeries, mode('silueta').imageReveal!).map((candidate) => candidate.id));
    const spell = cards.find((card) => String(card.attrs.clase).startsWith('Carta'));
    expect(spell).toBeDefined();
    expect(candidates.has(spell!.id)).toBe(false);
    expect(eligibleEntities(cards, allSeries)).toContain(spell);
  });
});

describe('Texto', () => {
  it('muestra el texto de la carta, y su clase, tipo y atributo si se falla: las tres líneas existen para toda carta', () => {
    const config = mode('texto').textClue!;
    const candidates = textCandidates(cards, rawContents, allSeries, config);
    expect(candidates.length).toBeGreaterThanOrEqual(defaultMinPool('text-clue'));
    for (const candidate of candidates) {
      const lines = lineStates(config.lines, Infinity, candidate.entity, candidate.contents[0]);
      expect(lines[0].line.after, candidate.id).toBe(0);
      expect(lines[0].text, candidate.id).not.toBe('');
      expect(lines.length, candidate.id).toBe(config.lines.length);
    }
  });
});

describe('Mayor o Menor', () => {
  const metrics = () => mode('mayor-o-menor').higherLower!.metrics;

  it('solo hay monstruos con ATK y DEF numéricos; ni las magias, ni las trampas, ni los de ATK o DEF "?"', () => {
    const pool = higherLowerPool(cards, allSeries, metrics());
    expect(pool.length).toBeGreaterThanOrEqual(defaultMinPool('higher-lower'));
    for (const entity of pool) {
      expect(String(entity.attrs.clase), entity.id).toMatch(/^Monstruo/);
      expect(typeof entity.attrs.atk, entity.id).toBe('number');
      expect(typeof entity.attrs.def, entity.id).toBe('number');
    }
    const leftOut = cards.filter((card) => !pool.includes(card));
    expect(leftOut.every((card) => typeof card.attrs.atk !== 'number' || typeof card.attrs.def !== 'number')).toBe(true);
  });

  it('ATK y DEF se alternan por día, y cada ronda compara dos monstruos con valores distintos en la métrica del día', () => {
    expect(metricOfDay(metrics(), 0).key).not.toBe(metricOfDay(metrics(), 1).key);
    expect(new Set([0, 1, 2, 3].map((day) => metricOfDay(metrics(), day).key))).toEqual(new Set(['atk', 'def']));
    const pool = higherLowerPool(cards, allSeries, metrics());
    for (let day = 0; day < 40; day++) {
      const key = metricOfDay(metrics(), day).key;
      const rounds = buildRounds(pool, key, { ...ctx, mode: 'mayor-o-menor', day }, MAX_ROUNDS);
      expect(rounds.length, `día ${day}`).toBeGreaterThan(0);
      for (const round of rounds) {
        expect(round.a.attrs[key], `día ${day}`).not.toBe(round.b.attrs[key]);
        expect(round.a.id).not.toBe(round.b.id);
      }
    }
  });

  it('es la misma secuencia para quien tenga los mismos filtros, aunque los datos vengan en otro orden', () => {
    const ids = (list: readonly Entity[]) =>
      buildRounds(higherLowerPool(list, allSeries, metrics()), 'atk', { ...ctx, mode: 'mayor-o-menor' }, MAX_ROUNDS).map((round) => `${round.a.id}|${round.b.id}`);
    expect(ids([...cards].reverse())).toEqual(ids(cards));
  });
});

describe('Invocación', () => {
  it('cada lista de materiales es de un monstruo del pool, y las respuestas equivalentes existen', () => {
    const config = mode('invocacion').revealList!;
    const candidates = listCandidates(cards, rawContents, allSeries, config);
    expect(candidates.length).toBeGreaterThanOrEqual(defaultMinPool('reveal-list'));
    const known = new Set(cards.map((card) => card.id));
    for (const candidate of candidates) {
      expect(String(candidate.entity.attrs.clase), candidate.id).toMatch(/^Monstruo/);
      for (const content of candidate.contents) {
        expect(itemsOf(content, config.field).length, content.id).toBeGreaterThanOrEqual(2);
        for (const id of (content.payload.accepts as string[]) ?? []) expect(known.has(id), `${content.id}: ${id}`).toBe(true);
      }
    }
  });

  it('con solo 5D\'s no hay invocaciones: el modo no alcanza el pool mínimo', () => {
    const size = listCandidates(cards, rawContents, ['5ds'], mode('invocacion').revealList!).length;
    expect(hasMinimumPool(size, defaultMinPool('reveal-list'))).toBe(false);
  });
});

describe('Deck y Carta insignia', () => {
  it('el deck revela las cartas del duelista de la menos a la más icónica, y la última es su carta as', () => {
    const config = mode('deck').revealList!;
    const candidates = listCandidates(duelists, rawContents, allSeries, config);
    expect(candidates).toHaveLength(duelists.length);
    const aces = new Map(rawContents.filter((content) => content.kind === 'ace-card').map((content) => [content.entityId, content.payload.card as string]));
    const cardById = new Map(cards.map((card) => [card.id, card]));
    for (const candidate of candidates) {
      const items = itemsOf(candidate.contents[0], config.field);
      expect(items.length, candidate.id).toBeGreaterThanOrEqual(5);
      expect(items.at(-1), candidate.id).toBe(cardById.get(aces.get(candidate.id) ?? '')?.name.es);
    }
  });

  it('la imagen de Carta insignia es la carta entera del as, con la proporción de una carta', () => {
    const candidates = imageCandidates(duelists, rawContents, allSeries, mode('carta-insignia').imageReveal!);
    expect(candidates).toHaveLength(duelists.length);
    for (const candidate of candidates) {
      expect(candidate.images, candidate.id).toHaveLength(1);
      const [image] = candidate.images;
      expect(image.stem, candidate.id).toMatch(/^yugioh\/cards-full\//);
      expect(image.height / image.width, candidate.id).toBeGreaterThan(1.3);
      expect(image.height / image.width, candidate.id).toBeLessThan(1.6);
    }
  });
});

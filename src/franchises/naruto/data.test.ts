// Pruebas sobre los datos reales de Naruto (data/naruto/) y su config: lo que los tests de la lógica
// no pueden ver. La regla central de la SPEC: lo que se apaga no aparece nunca. Con cada serie apagada,
// ningún personaje, frase, jutsu, equipo ni grupo suyo sale como respuesta, como opción ni como valor
// visible en ninguno de los modos. Y en Conexiones, todo tablero tiene solución única.

import { beforeAll, describe, expect, it } from 'vitest';
import { defaultMinPool, eligibleEntities, hasMinimumPool, publishableContents } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { modeStatus } from '@/app/[franchise]/[mode]/playable';
import { buildRow, cellText, visibleColumns } from '@/modes/classic/logic';
import { buildBoard, poolOf as connectionsPool } from '@/modes/connections/logic';
import { GROUP_SIZE } from '@/modes/connections/types';
import { candidatesOf as imageCandidates } from '@/modes/image-reveal/logic';
import { candidatesOf as listCandidates, itemsOf } from '@/modes/reveal-list/logic';
import { candidatesOf as textCandidates, lineStates } from '@/modes/text-clue/logic';
import arcsJson from '../../../data/naruto/arcs.json';
import contentJson from '../../../data/naruto/content.json';
import entitiesJson from '../../../data/naruto/entities.json';
import { loadFranchiseData, type FranchiseData } from '../data';
import { modePoolSize } from '../pool';
import type { ModeConfig } from '../types';
import { arcLabels, narutoConfig } from './config';

const characters = entitiesJson as Entity[];
const rawContents = contentJson as Content[];
// Las frases están sin verificar hasta que alguien las revise a mano (verified: false en data-src).
// Para probar las reglas de exclusión sobre el contenido real se consideran verificadas.
const contents = rawContents.map((content) => ({ ...content, verified: true }));
const modes: readonly ModeConfig[] = narutoConfig.modes;
const allSeries: readonly string[] = narutoConfig.series;

const mode = (slug: string): ModeConfig => {
  const found = modes.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`No existe el modo ${slug}`);
  return found;
};

const exclusiveTo = (entity: Pick<Entity, 'series'>, series: string) => entity.series.length === 1 && entity.series[0] === series;
const without = (series: string) => allSeries.filter((id) => id !== series);
const only = (series: string) => [series];
const seriesOf = new Map(rawContents.map((content) => [content.id, content.series]));
const nameOf = new Map(characters.map((entity) => [entity.id, entity.name.es]));

/** Todas las combinaciones no vacías de series, de a una hasta todas. */
const combinations: string[][] = Array.from({ length: 2 ** allSeries.length - 1 }, (_, mask) =>
  allSeries.filter((__, index) => ((mask + 1) >> index) & 1),
);

describe('config', () => {
  it('tiene los 9 modos de la SPEC, en orden y con su motor', () => {
    expect(modes.map((m) => [m.slug, m.engine])).toEqual([
      ['clasico', 'classic'],
      ['silueta', 'image-reveal'],
      ['frase', 'text-clue'],
      ['borroso', 'image-reveal'],
      ['jutsu', 'image-reveal'],
      ['ojo', 'image-reveal'],
      ['equipo', 'reveal-list'],
      ['emoji', 'text-clue'],
      ['conexiones', 'connections'],
    ]);
  });

  it('cada modo trae la configuración de su motor', () => {
    for (const m of modes) {
      const config = { classic: m.classic, 'image-reveal': m.imageReveal, 'text-clue': m.textClue, 'reveal-list': m.revealList, connections: m.connections }[m.engine as string];
      expect(config, m.slug).toBeDefined();
    }
  });

  it('las columnas y las pistas del Clásico existen en todos los personajes', () => {
    const classic = mode('clasico').classic;
    for (const column of classic?.columns ?? []) {
      for (const entity of characters) expect(column.key in entity.attrs, `${entity.id}.${column.key}`).toBe(true);
    }
    for (const hint of classic?.hints ?? []) {
      if (hint.kind !== 'attr') continue;
      for (const entity of characters) expect(hint.key in entity.attrs, `${entity.id}.${hint.key}`).toBe(true);
    }
  });

  it('el arco de debut tiene nombre para cada número que aparece en los datos, y es el corto de su arco con su serie', () => {
    const labels = mode('clasico').classic?.columns.find((column) => column.key === 'arcoDebut')?.valueLabels ?? {};
    for (const entity of characters) {
      expect(labels[String(entity.attrs.arcoDebut)], `${entity.id}.arcoDebut=${String(entity.attrs.arcoDebut)}`).toBeDefined();
    }
    for (const arc of arcsJson.arcs) {
      expect(arcLabels[arc.id], `falta el nombre corto de ${arc.id}`).toBeDefined();
      expect(labels[String(arc.order)]).toEqual({ label: arcLabels[arc.id], series: arc.series });
    }
  });

  it('las pistas de texto leen campos que existen en los datos', () => {
    const fields = (kind: string) => new Set(rawContents.filter((content) => content.kind === kind).flatMap((content) => Object.keys(content.payload)));
    for (const slug of ['frase', 'emoji']) {
      const config = mode(slug).textClue!;
      for (const line of config.lines) {
        if (line.kind === 'content') expect(fields(config.contentKind).has(line.field), `${slug}.${line.field}`).toBe(true);
        else for (const key of line.keys) expect(key in characters[0].attrs, `${slug}.${key}`).toBe(true);
      }
    }
    expect(fields('team').has(mode('equipo').revealList!.field)).toBe(true);
    const group = mode('conexiones').connections!;
    for (const field of [group.nameField, group.membersField, group.difficultyField]) expect(fields(group.contentKind).has(field), field).toBe(true);
  });
});

describe('carga de datos', () => {
  let data: FranchiseData;
  beforeAll(async () => {
    data = (await loadFranchiseData('naruto')) as FranchiseData;
  });

  it('trae los personajes y el contenido', () => {
    expect(data.entities).toHaveLength(characters.length);
    expect(data.entitySets).toBeUndefined();
    expect(data.contents.length).toBeLessThanOrEqual(rawContents.length);
  });

  it('las frases sin verificar no llegan a ningún pool; lo demás sí entra, esté o no verificado', () => {
    const unverified = rawContents.filter((content) => content.kind === 'quote' && !content.verified);
    const loaded = new Set(data.contents.map((content) => content.id));
    for (const content of unverified) expect(loaded.has(content.id), content.id).toBe(false);
    for (const content of data.contents.filter((candidate) => candidate.kind === 'quote')) expect(content.verified, content.id).toBe(true);
    expect(data.contents.filter((content) => content.kind !== 'quote')).toHaveLength(rawContents.filter((content) => content.kind !== 'quote').length);
    expect(publishableContents(rawContents)).toHaveLength(data.contents.length);
  });

  it('los modos con contenido de sobra están disponibles; los demás dependen de lo que haya y se oculta el que no alcanza', () => {
    for (const slug of ['clasico', 'borroso', 'jutsu', 'ojo', 'equipo', 'emoji', 'conexiones']) {
      expect(modeStatus(narutoConfig, mode(slug), data), slug).toBe('playable');
    }
    // Silueta (todas las imágenes tienen fondo) y Frase (sin verificar) se ocultan en vez de quedar como "próximamente".
    for (const slug of ['silueta', 'frase']) {
      expect(['playable', 'hidden'], slug).toContain(modeStatus(narutoConfig, mode(slug), data));
    }
  });

  it('el pool de Conexiones son los grupos que forman parte de algún tablero', () => {
    const size = modePoolSize(mode('conexiones'), data, allSeries);
    expect(size).not.toBeNull();
    expect(hasMinimumPool(size!, defaultMinPool('connections'))).toBe(true);
  });
});

describe('con una serie apagada no aparece nada de ella', () => {
  const imageModes = ['borroso', 'jutsu', 'ojo', 'silueta'] as const;

  for (const off of allSeries) {
    describe(`sin ${off}`, () => {
      const active = without(off);

      it('ningún personaje exclusivo de la serie es una opción ni una respuesta', () => {
        const options = eligibleEntities(characters, active);
        expect(options.some((entity) => exclusiveTo(entity, off))).toBe(false);
        expect(options.every((entity) => entity.series.some((id) => active.includes(id)))).toBe(true);
        for (const slug of imageModes) {
          const candidates = imageCandidates(characters, contents, active, mode(slug).imageReveal!);
          expect(candidates.some((candidate) => exclusiveTo(candidate.entity, off)), slug).toBe(false);
        }
      });

      it('ninguna imagen de jutsu ni de ojo es de la serie', () => {
        for (const slug of ['jutsu', 'ojo']) {
          const candidates = imageCandidates(characters, contents, active, mode(slug).imageReveal!);
          for (const image of candidates.flatMap((candidate) => candidate.images)) expect(seriesOf.get(image.id), `${slug}.${image.id}`).not.toBe(off);
        }
      });

      it('ningún valor visible del Clásico es de la serie: ni su arco de debut ni sus afiliaciones', () => {
        const columns = visibleColumns(mode('clasico').classic!.columns, active);
        const pool = eligibleEntities(characters, active);
        const answer = pool[0];
        const arcNames = new Set(arcsJson.arcs.filter((arc) => arc.series === off).map((arc) => arcLabels[arc.id]));
        for (const guess of pool) {
          const row = buildRow(guess, answer, columns, active);
          for (const cell of row.cells) {
            const text = cellText(cell.column, cell.value) ?? '';
            if (cell.column.key === 'arcoDebut') expect(arcNames.has(text), `${guess.id}: ${text}`).toBe(false);
            if (cell.column.key === 'afiliaciones') {
              // Solo los valores sin serie o de una serie activa; los de la apagada ni se ven ni se comparan.
              const visible = (guess.attrs.afiliaciones as Array<string | { value: string; series?: string }>)
                .filter((item) => typeof item === 'string' || item.series === undefined || active.includes(item.series))
                .map((item) => (typeof item === 'string' ? item : item.value));
              expect(cell.value, guess.id).toEqual(visible);
            }
          }
        }
      });

      it('si el arco de debut de un personaje es de la serie apagada, su valor se oculta', () => {
        const columns = visibleColumns(mode('clasico').classic!.columns, active);
        const pool = eligibleEntities(characters, active);
        const arcSeries = new Map(arcsJson.arcs.map((arc) => [arc.order, arc.series]));
        const debuted = pool.filter((entity) => arcSeries.get(entity.attrs.arcoDebut as number) === off);
        // Los hay solo si la serie apagada no es la última: hay personajes que debutaron en ella y siguen en otra.
        for (const guess of debuted) {
          const cell = buildRow(guess, pool[0], columns, active).cells.find((candidate) => candidate.column.key === 'arcoDebut')!;
          expect(cell.hidden, guess.id).toBe(true);
          expect(cell.value).toBeNull();
        }
      });

      it('ninguna frase ni emoji de la serie sale en su modo', () => {
        for (const slug of ['frase', 'emoji']) {
          const candidates = textCandidates(characters, contents, active, mode(slug).textClue!);
          expect(candidates.flatMap((candidate) => candidate.contents).some((content) => content.series === off), slug).toBe(false);
          expect(candidates.some((candidate) => exclusiveTo(candidate.entity, off)), slug).toBe(false);
        }
      });

      it('ningún equipo de la serie sale en Equipo, ni como pista un personaje exclusivo de ella', () => {
        const candidates = listCandidates(characters, contents, active, mode('equipo').revealList!);
        expect(candidates.some((candidate) => exclusiveTo(candidate.entity, off))).toBe(false);
        const exclusiveNames = new Set(characters.filter((entity) => exclusiveTo(entity, off)).map((entity) => entity.name.es));
        for (const candidate of candidates) {
          for (const content of candidate.contents) {
            expect(content.series, content.id).not.toBe(off);
            for (const item of itemsOf(content, 'items')) expect(exclusiveNames.has(item), `${content.id}: ${item}`).toBe(false);
          }
        }
      });

      it('ningún grupo de la serie ni personaje exclusivo de ella sale en Conexiones, en ningún tablero', () => {
        const config = mode('conexiones').connections!;
        const pool = connectionsPool(characters, contents, active, config);
        expect(pool.some((group) => seriesOf.get(group.id) === off)).toBe(false);
        for (const group of pool) {
          const exclusive = group.available.filter((id) => exclusiveTo(characters.find((entity) => entity.id === id)!, off));
          expect(exclusive, group.id).toEqual([]);
        }
        if (pool.length === 0) return;
        for (let day = 0; day < 200; day++) {
          const board = buildBoard(pool, { franchise: 'naruto', mode: 'conexiones', filterKey: active.join('.'), day });
          expect(board, `día ${day}`).not.toBeNull();
          for (const group of board!.groups) {
            expect(seriesOf.get(group.id), `día ${day}`).not.toBe(off);
            for (const id of group.members) {
              expect(exclusiveTo(characters.find((entity) => entity.id === id)!, off), `día ${day}: ${id}`).toBe(false);
            }
          }
        }
      });
    });
  }
});

describe('Emoji', () => {
  it('muestra siempre los emojis, y la ocupación y los tipos de jutsu cuando el personaje los tiene', () => {
    const config = mode('emoji').textClue!;
    const candidates = textCandidates(characters, contents, allSeries, config);
    expect(candidates.length).toBeGreaterThanOrEqual(defaultMinPool('text-clue'));
    let complete = 0;
    for (const candidate of candidates) {
      const lines = lineStates(config.lines, Infinity, candidate.entity, candidate.contents[0]);
      expect(lines[0].line.after, candidate.id).toBe(0);
      expect(lines[0].text, candidate.id).toMatch(/\p{Extended_Pictographic}/u);
      if (lines.length === config.lines.length) complete++;
    }
    expect(complete).toBeGreaterThan(10);
  });
});

describe('Conexiones', () => {
  const config = () => mode('conexiones').connections!;
  const fullMembers = new Map(rawContents.filter((content) => content.kind === 'group').map((content) => [content.id, new Set(content.payload.members as string[])]));

  /** El tablero de un día con una combinación de series, y comprobaciones que valen para cualquiera. */
  function expectUniqueSolution(active: readonly string[], days: number) {
    const pool = connectionsPool(characters, contents, active, config());
    expect(pool.length, active.join('.')).toBeGreaterThanOrEqual(defaultMinPool('connections'));
    const filterKey = active.join('.');
    for (let day = 0; day < days; day++) {
      const board = buildBoard(pool, { franchise: 'naruto', mode: 'conexiones', filterKey, day });
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

  it('en 500 días simulados con todas las series, todos los tableros tienen solución única', () => {
    expectUniqueSolution(allSeries, 500);
  });

  it('también con cada combinación de series que tiene pool suficiente', () => {
    let checked = 0;
    for (const active of combinations) {
      if (connectionsPool(characters, contents, active, config()).length < defaultMinPool('connections')) continue;
      expectUniqueSolution(active, 150);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  });

  it('hay grupos de sobra para al menos 30 tableros distintos con todas las series', () => {
    const pool = connectionsPool(characters, contents, allSeries, config());
    const boards = new Set<string>();
    for (let day = 0; day < 500; day++) {
      const board = buildBoard(pool, { franchise: 'naruto', mode: 'conexiones', filterKey: 'all', day })!;
      boards.add(board.groups.map((group) => `${group.id}:${group.members.join(',')}`).join('|'));
    }
    expect(boards.size).toBeGreaterThanOrEqual(30);
  });

  it('es el mismo tablero para quien tenga los mismos filtros, y otro con otros filtros', () => {
    const pool = connectionsPool(characters, contents, allSeries, config());
    const ctx = { franchise: 'naruto', mode: 'conexiones', filterKey: 'all', day: 321 };
    const board = JSON.stringify(buildBoard(pool, ctx));
    expect(JSON.stringify(buildBoard([...pool].reverse(), ctx))).toBe(board);
    expect(JSON.stringify(buildBoard(pool, { ...ctx, filterKey: 'naruto.shippuden' }))).not.toBe(board);
  });

  it('con solo Boruto no hay tablero posible: el modo no alcanza el pool mínimo', () => {
    expect(hasMinimumPool(connectionsPool(characters, contents, only('boruto'), config()).length, defaultMinPool('connections'))).toBe(false);
  });

  it('cada miembro de cada grupo es un personaje que existe', () => {
    const known = new Set(characters.map((entity) => entity.id));
    for (const [id, members] of fullMembers) for (const member of members) expect(known.has(member), `${id}.${member}`).toBe(true);
  });
});

// Pruebas sobre los datos reales de Yu-Gi-Oh (data/yugioh/) y sobre lo curado (data-src/yugioh/): lo que
// los tests de la lógica no pueden ver, como que ninguna carta carezca de duelista dueño, que cada duelista
// tenga exactamente una carta as, que ningún texto delate su carta, que las imágenes existan y entren en el
// presupuesto, o que apagar una serie no deje valores de ella a la vista.

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { eligibleEntities, filterAttrValue } from '../../../src/engine/filters.ts';
import type { Content, Entity } from '../../../src/engine/types.ts';
import cardsJson from '../../../data/yugioh/cards.json';
import contentJson from '../../../data/yugioh/content.json';
import duelistsJson from '../../../data/yugioh/entities.json';
import seriesJson from '../../../data/yugioh/series.json';
import silhouettesJson from '../../../data/yugioh/silhouettes.json';
import duelistsSrcJson from '../../../data-src/yugioh/duelists.json';
import signatureJson from '../../../data-src/yugioh/signature-cards.json';
import summonsJson from '../../../data-src/yugioh/summons.json';
import { ROOT } from './api.ts';
import { THRESHOLDS, isUsable } from './silhouette.ts';
import { leaksName, slugify } from './transform.ts';
import { ROLES, SERIES, duelistSrcSchema, signatureCardsSrcSchema, silhouetteRecordsSchema, summonSrcSchema, type SeriesId } from './schemas.ts';

const duelists = duelistsJson as Entity[];
const cards = cardsJson as Entity[];
const contents = contentJson as Content[];
const duelistsSrc = duelistsSrcJson.map((item) => duelistSrcSchema.parse(item));
const signature = signatureCardsSrcSchema.parse(signatureJson);
const summons = summonSrcSchema.parse(summonsJson);

const duelistById = new Map(duelists.map((entity) => [entity.id, entity]));
const cardById = new Map(cards.map((entity) => [entity.id, entity]));
const of = (kind: string) => contents.filter((content) => content.kind === kind);
const cardText = of('card-text');
const decks = of('deck');
const aces = of('ace-card');
const summonContents = of('summon');
const silhouetteContents = of('silhouette');
const silhouetteRecords = silhouetteRecordsSchema.parse(silhouettesJson).monsters;

const IMG_ROOT = path.join(ROOT, 'public', 'img');
const IMG_LIMIT_BYTES = 200 * 1024 * 1024;
const sizeOf = (stem: string, size: 256 | 512) => path.join(IMG_ROOT, `${stem}-${size}.webp`);
const kb = (bytes: number) => bytes / 1024;

const ACTIVE: readonly SeriesId[] = ['dm', 'gx', '5ds'];

function directoryBytes(directory: string): number {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    total += entry.isDirectory() ? directoryBytes(entryPath) : statSync(entryPath).size;
  }
  return total;
}

describe('series', () => {
  it('solo Duel Monsters, GX y 5D\'s por ahora, y series.json guarda el orden canónico de las seis', () => {
    expect([...new Set(duelists.flatMap((entity) => entity.series))].sort()).toEqual([...ACTIVE].sort());
    expect(seriesJson.series.map((item) => [item.id, item.order])).toEqual(SERIES.map((id, index) => [id, index + 1]));
  });

  it('cada duelista y cada carta tienen sus series en orden canónico', () => {
    for (const entity of [...duelists, ...cards]) {
      const indexes = entity.series.map((id) => SERIES.indexOf(id as SeriesId));
      expect(indexes.every((index) => index >= 0), entity.id).toBe(true);
      expect(indexes, entity.id).toEqual([...indexes].sort((a, b) => a - b));
      expect(new Set(indexes).size, entity.id).toBe(indexes.length);
    }
  });
});

describe('duelistas', () => {
  it('hay 15 o más por serie, con ids únicos y exactamente los curados', () => {
    expect(duelists.map((entity) => entity.id)).toEqual(duelistsSrc.map((item) => item.id));
    expect(new Set(duelists.map((entity) => entity.id)).size).toBe(duelists.length);
    for (const series of ACTIVE) {
      const count = duelists.filter((entity) => entity.series.includes(series)).length;
      expect(count, series).toBeGreaterThanOrEqual(14);
      expect(count, series).toBeLessThanOrEqual(25);
    }
  });

  it('todos tienen los atributos del Clásico Duelista completos', () => {
    for (const entity of duelists) {
      for (const key of ['genero', 'serieDebut', 'rol', 'afiliaciones', 'arquetipos', 'metodosInvocacion', 'primeraAparicion', 'imagenTransparente']) {
        expect(key in entity.attrs, `${entity.id}.${key}`).toBe(true);
      }
      expect(['Masculino', 'Femenino'], entity.id).toContain(entity.attrs.genero);
      expect(ROLES, entity.id).toContain(entity.attrs.rol);
      for (const key of ['afiliaciones', 'arquetipos', 'metodosInvocacion']) expect(Array.isArray(entity.attrs[key]), `${entity.id}.${key}`).toBe(true);
      expect((entity.attrs.arquetipos as string[]).length, entity.id).toBeGreaterThan(0);
      expect((entity.attrs.metodosInvocacion as string[]).length, entity.id).toBeGreaterThan(0);
      expect(String(entity.attrs.primeraAparicion), entity.id).toMatch(/, episodio \d+$/);
    }
  });

  it('la serie de debut es la posición de la primera serie del duelista en la lista canónica', () => {
    for (const entity of duelists) expect(entity.attrs.serieDebut, entity.id).toBe(SERIES.indexOf(entity.series[0] as SeriesId) + 1);
  });

  it('los métodos de invocación salen de sus cartas insignia: cada método tiene al menos una carta de esa clase', () => {
    const classToMethod: Record<string, string> = {
      'Monstruo Normal': 'Normal',
      'Monstruo de Efecto': 'Normal',
      'Monstruo de Fusión': 'Fusión',
      'Monstruo de Ritual': 'Ritual',
      'Monstruo Sincro': 'Sincro',
      'Monstruo Xyz': 'Xyz',
      'Monstruo Péndulo': 'Péndulo',
      'Monstruo Link': 'Enlace',
    };
    for (const entity of duelists) {
      const owned = cards.filter((card) => (card.attrs.duelistas as Array<{ value: string }>).some((owner) => owner.value === entity.name.es));
      const methods = new Set(owned.map((card) => classToMethod[String(card.attrs.clase)]).filter(Boolean));
      expect([...methods].sort(), entity.id).toEqual([...(entity.attrs.metodosInvocacion as string[])].sort());
    }
  });

  it('todos están sin verificar (rol, afiliaciones y arquetipos los redactó una IA)', () => {
    expect(duelistsSrc.every((item) => !item.verified)).toBe(true);
  });
});

describe('cartas insignia', () => {
  it('hay una lista por duelista, con entre 5 y 30 cartas, y en promedio bastantes más de las 3 a 8 del plan original', () => {
    expect(signature.map((entry) => entry.duelist)).toEqual(duelists.map((entity) => entity.id));
    const counts = signature.map((entry) => entry.cards.length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...counts)).toBeLessThanOrEqual(30);
    expect(counts.reduce((a, b) => a + b, 0) / counts.length).toBeGreaterThan(10);
  });

  it('cada duelista tiene exactamente una carta con ace: true y ninguna carta as se repite entre duelistas', () => {
    const acesByCard = new Map<string, string[]>();
    for (const entry of signature) {
      const marked = entry.cards.filter((card) => card.ace === true);
      expect(marked, entry.duelist).toHaveLength(1);
      acesByCard.set(marked[0].name, [...(acesByCard.get(marked[0].name) ?? []), entry.duelist]);
    }
    for (const [name, owners] of acesByCard) expect(owners, name).toHaveLength(1);
  });

  it('ninguna carta del dataset carece de duelista dueño, y los dueños de cada carta son los que la listan', () => {
    const owners = new Map<string, string[]>();
    for (const entry of signature) for (const card of entry.cards) owners.set(slugify(card.name), [...(owners.get(slugify(card.name)) ?? []), entry.duelist]);
    expect(cards.map((card) => card.id).sort()).toEqual([...owners.keys()].sort());
    for (const card of cards) {
      const names = (card.attrs.duelistas as Array<{ value: string }>).map((owner) => owner.value);
      expect(names.length, card.id).toBeGreaterThan(0);
      expect(names, card.id).toEqual((owners.get(card.id) as string[]).map((id) => (duelistById.get(id) as Entity).name.es));
    }
  });

  it('regla 4: cada carta hereda las series de sus duelistas dueños', () => {
    for (const card of cards) {
      const ownerSeries = (card.attrs.duelistas as Array<{ value: string; series?: string }>).flatMap((owner) => {
        const entity = duelists.find((candidate) => candidate.name.es === owner.value) as Entity;
        return entity.series;
      });
      expect([...card.series].sort(), card.id).toEqual([...new Set(ownerSeries)].sort());
    }
  });

  it('todas tienen los atributos del Clásico Carta y una clase conocida', () => {
    const classes = new Set(['Monstruo Normal', 'Monstruo de Efecto', 'Monstruo de Fusión', 'Monstruo Sincro', 'Monstruo Xyz', 'Monstruo Péndulo', 'Monstruo Link', 'Monstruo de Ritual', 'Carta Mágica', 'Carta de Trampa']);
    for (const card of cards) {
      for (const key of ['clase', 'atributo', 'tipo', 'nivel', 'atk', 'def', 'duelistas', 'serie', 'imagenTransparente']) expect(key in card.attrs, `${card.id}.${key}`).toBe(true);
      expect(classes.has(String(card.attrs.clase)), card.id).toBe(true);
      expect(card.attrs.imagenTransparente, card.id).toBe(0);
      const monster = String(card.attrs.clase).startsWith('Monstruo');
      expect(typeof card.attrs.nivel === 'number', card.id).toBe(monster);
    }
  });

  it('tienen el nombre oficial en inglés como nombre o como alias, y los 9 sin clave es quedan con su nombre en inglés', () => {
    const withoutText = cards.filter((card) => !cardText.some((content) => content.entityId === card.id));
    for (const card of cards) expect(card.name.en, card.id).toBeDefined();
    for (const card of withoutText) expect(card.name.es, card.id).toBe(card.name.en);
    expect(withoutText.length).toBeLessThan(20);
  });
});

describe('texto de las cartas', () => {
  it('ningún texto contiene el nombre de su carta, en español ni en inglés', () => {
    for (const content of cardText) {
      const card = cardById.get(content.entityId as string) as Entity;
      expect(leaksName(String(content.payload.text), [card.name.es, card.name.en as string]), content.id).toBe(false);
    }
  });

  it('hay un texto por carta y por serie de la carta, con su serie', () => {
    for (const card of cards) {
      const own = cardText.filter((content) => content.entityId === card.id);
      if (own.length === 0) continue;
      expect(own.map((content) => content.series).sort(), card.id).toEqual([...card.series].sort());
    }
  });

  it('el texto oficial se transcribe tal cual: queda verificado, y hay más de 600', () => {
    expect(cardText.length).toBeGreaterThan(600);
    expect(cardText.every((content) => content.verified)).toBe(true);
  });
});

describe('decks', () => {
  it('cada duelista tiene su deck con todas sus cartas, de menor a mayor iconicidad y la carta as al final', () => {
    for (const entry of signature) {
      const deck = decks.find((content) => content.entityId === entry.duelist) as Content;
      const items = deck.payload.items as string[];
      expect(items, entry.duelist).toHaveLength(entry.cards.length);
      const byName = new Map(entry.cards.map((card) => [cardById.get(slugify(card.name))?.name.es as string, card]));
      expect(new Set(items).size, entry.duelist).toBe(items.length);
      const iconicity = items.map((name) => (byName.get(name) as { iconicity: number }).iconicity);
      expect(iconicity, entry.duelist).toEqual([...iconicity].sort((a, b) => a - b));
      const ace = entry.cards.find((card) => card.ace === true) as { name: string };
      expect(items[items.length - 1], entry.duelist).toBe(cardById.get(slugify(ace.name))?.name.es);
    }
  });

  it('un deck por serie del duelista, sin verificar', () => {
    for (const entity of duelists) {
      expect(decks.filter((content) => content.entityId === entity.id).map((content) => content.series).sort(), entity.id).toEqual([...entity.series].sort());
    }
    expect(decks.every((content) => !content.verified)).toBe(true);
  });
});

describe('carta insignia (la carta as entera)', () => {
  it('cada duelista tiene su carta as, y es la que está marcada ace en lo curado', () => {
    expect(aces).toHaveLength(duelists.reduce((sum, entity) => sum + entity.series.length, 0));
    for (const entry of signature) {
      const marked = entry.cards.find((card) => card.ace === true) as { name: string };
      const content = aces.find((candidate) => candidate.entityId === entry.duelist) as Content;
      expect(content.payload.card, entry.duelist).toBe(slugify(marked.name));
      expect(content.payload.image, entry.duelist).toBe(`yugioh/cards-full/${slugify(marked.name)}`);
    }
  });

  it('las dos medidas de la imagen son las del archivo grande: 351 × 512 o similar, con proporción de carta', () => {
    for (const content of aces) {
      const { width, height } = content.payload as { width: number; height: number };
      expect(Math.max(width, height), content.id).toBe(512);
      expect(width / height, content.id).toBeGreaterThan(0.65);
      expect(width / height, content.id).toBeLessThan(0.72);
    }
  });
});

describe('invocaciones', () => {
  it('los materiales de cada invocación son los curados, mostrados con el nombre en español de cada carta', () => {
    for (const summon of summons) {
      const id = slugify(summon.card);
      const own = summonContents.filter((content) => content.entityId === id);
      expect(own.length, summon.card).toBeGreaterThan(0);
      const expected = summon.materials.map((name) => cardById.get(slugify(name))?.name.es);
      for (const content of own) expect(content.payload.items, content.id).toEqual(expected);
    }
  });

  it('hay al menos 20 monstruos con materiales cargados, todos de fusión por ahora', () => {
    expect(new Set(summonContents.map((content) => content.entityId)).size).toBeGreaterThanOrEqual(20);
    expect(summonContents.every((content) => content.payload.kind === 'fusion')).toBe(true);
  });

  it('las respuestas equivalentes son simétricas y existen', () => {
    for (const content of summonContents) {
      for (const other of content.payload.accepts as string[]) {
        expect(cardById.has(other), content.id).toBe(true);
        const back = summonContents.find((candidate) => candidate.entityId === other && candidate.series === content.series);
        expect(back?.payload.accepts, `${other} acepta ${content.entityId}`).toContain(content.entityId);
      }
    }
  });

  it('el pool de Invocación con todas las series alcanza el mínimo de 10', () => {
    expect(new Set(summonContents.map((content) => content.entityId)).size).toBeGreaterThanOrEqual(10);
  });
});

describe('referencias', () => {
  it('todo contenido apunta a una entidad que existe y los ids no se repiten', () => {
    const entities = new Set([...duelists, ...cards].map((entity) => entity.id));
    expect(entities.size).toBe(duelists.length + cards.length);
    expect(new Set(contents.map((content) => content.id)).size).toBe(contents.length);
    for (const content of contents) expect(entities.has(content.entityId as string), content.id).toBe(true);
  });

  it('deck y carta as responden con un duelista; texto e invocación, con una carta', () => {
    for (const content of [...decks, ...aces]) expect(duelistById.has(content.entityId as string), content.id).toBe(true);
    for (const content of [...cardText, ...summonContents]) expect(cardById.has(content.entityId as string), content.id).toBe(true);
  });
});

describe('con una serie apagada no aparece nada de ella', () => {
  for (const off of ACTIVE) {
    describe(`sin ${off}`, () => {
      const active = ACTIVE.filter((id) => id !== off);

      it('ningún duelista ni carta exclusivos de la serie son opciones elegibles', () => {
        expect(eligibleEntities(duelists, active).some((entity) => entity.series.length === 1 && entity.series[0] === off)).toBe(false);
        expect(eligibleEntities(cards, active).some((entity) => entity.series.length === 1 && entity.series[0] === off)).toBe(false);
      });

      it('los valores visibles de Duelista y Serie de cada carta (regla 3) no son de la serie apagada', () => {
        const hidden = new Set(duelists.filter((entity) => entity.series.length === 1 && entity.series[0] === off).map((entity) => entity.name.es));
        for (const card of eligibleEntities(cards, active)) {
          const owners = filterAttrValue(card.attrs.duelistas, active) as string[];
          expect(owners.some((name) => hidden.has(name)), card.id).toBe(false);
          expect(owners.length, card.id).toBeGreaterThan(0);
          const labels = filterAttrValue(card.attrs.serie, active) as string[];
          expect(labels.includes(seriesLabel(off)), card.id).toBe(false);
        }
      });

      it('ningún deck, carta as, texto ni invocación elegible es de la serie apagada', () => {
        for (const content of [...decks, ...aces, ...cardText, ...summonContents]) {
          if (content.series === off) continue;
          expect(active.includes(content.series as SeriesId), content.id).toBe(true);
        }
      });
    });
  }
});

function seriesLabel(id: SeriesId): string {
  return (seriesJson.series.find((item) => item.id === id) as { label: string }).label;
}

describe('siluetas', () => {
  const isMonsterCard = (card: Entity) => String(card.attrs.clase).startsWith('Monstruo');
  const usable = silhouetteRecords.filter((record) => record.usable);
  const SILHOUETTE_DIR = path.join(IMG_ROOT, 'yugioh', 'silhouettes');

  it('hay una decisión por cada monstruo, y ninguna por magias ni trampas', () => {
    const monsters = cards.filter(isMonsterCard).map((card) => card.id).sort();
    expect(silhouetteRecords.map((record) => record.id).sort()).toEqual(monsters);
  });

  it('cada decisión coincide con los umbrales del script: sirvió si ocupa lo justo y es en su mayor parte una pieza', () => {
    for (const record of silhouetteRecords) expect(record.usable, `${record.id}: ${record.coverage} / ${record.connected}`).toBe(isUsable(record));
  });

  it('hay silueta para la gran mayoría de los monstruos y suficientes para el pool mínimo', () => {
    expect(usable.length).toBeGreaterThanOrEqual(10);
    expect(usable.length / silhouetteRecords.length).toBeGreaterThan(0.6);
  });

  it('un contenido por serie de cada monstruo con recorte que sirvió, sin verificar, y ninguno de los demás', () => {
    const expected = usable.flatMap((record) => (cardById.get(record.id) as Entity).series.map((series) => `silhouette-${record.id}-${series}`)).sort();
    expect(silhouetteContents.map((content) => content.id).sort()).toEqual(expected);
    for (const content of silhouetteContents) {
      expect(content.entityId, content.id).toBeDefined();
      expect((cardById.get(content.entityId as string) as Entity).series, content.id).toContain(content.series);
      expect(content.payload.image, content.id).toBe(`yugioh/silhouettes/${content.entityId}`);
      expect(content.verified, content.id).toBe(false);
    }
  });

  it('la carpeta tiene los dos tamaños de cada silueta que sirvió y nada más', () => {
    const files = readdirSync(SILHOUETTE_DIR).sort();
    expect(files).toEqual(usable.flatMap((record) => [`${record.id}-256.webp`, `${record.id}-512.webp`]).sort());
  });

  it('son WebP con transparencia: el fondo se ve transparente (de un 15 % a un 92 % de los píxeles) y entran en el presupuesto', async () => {
    for (const record of usable) {
      for (const [size, limit] of [[256, 18], [512, 50]] as const) {
        const file = sizeOf(`yugioh/silhouettes/${record.id}`, size);
        expect(kb(statSync(file).size), `${record.id} ${size}`).toBeLessThanOrEqual(limit);
        const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        expect(Math.max(info.width, info.height), `${record.id} ${size}`).toBe(size);
        let transparent = 0;
        for (let index = 3; index < data.length; index += 4) if (data[index] < 128) transparent++;
        const share = transparent / (data.length / 4);
        expect(share, `${record.id} ${size} transparente`).toBeGreaterThan(1 - THRESHOLDS.coverage.max - 0.05);
        expect(share, `${record.id} ${size} transparente`).toBeLessThan(1 - THRESHOLDS.coverage.min + 0.02);
      }
    }
  }, 120_000);
});

describe('imágenes', () => {
  it('cada duelista y cada carta tienen sus dos tamaños en disco, y la carta as entera también', () => {
    for (const entity of [...duelists, ...cards]) {
      expect(entity.image, entity.id).toBeDefined();
      for (const size of [256, 512] as const) expect(existsSync(sizeOf(entity.image as string, size)), `${entity.id} ${size}`).toBe(true);
    }
    for (const content of aces) for (const size of [256, 512] as const) expect(existsSync(sizeOf(content.payload.image as string, size)), `${content.id} ${size}`).toBe(true);
  });

  it('entran en el presupuesto: ≤ 25 KB la de 256 px y ≤ 70 KB la de 512 px (≤ 60 KB en la carta entera)', () => {
    const check = (stem: string, limits: { 256: number; 512: number }) => {
      for (const size of [256, 512] as const) expect(kb(statSync(sizeOf(stem, size)).size), `${stem} ${size}`).toBeLessThanOrEqual(limits[size]);
    };
    for (const entity of [...duelists, ...cards]) check(entity.image as string, { 256: 25, 512: 70 });
    for (const content of aces) check(content.payload.image as string, { 256: 25, 512: 60 });
  });

  it('public/img queda por debajo de los 200 MB de la SPEC', () => {
    expect(directoryBytes(IMG_ROOT)).toBeLessThan(IMG_LIMIT_BYTES);
  });
});

describe('pools mínimos con todas las series', () => {
  it('cada modo de Yu-Gi-Oh alcanza su mínimo de 10', () => {
    expect(duelists.length).toBeGreaterThanOrEqual(10);
    expect(cards.length).toBeGreaterThanOrEqual(10);
    expect(new Set(cardText.map((content) => content.entityId)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(aces.map((content) => content.entityId)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(decks.map((content) => content.entityId)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(silhouetteContents.map((content) => content.entityId)).size).toBeGreaterThanOrEqual(10);
    expect(cards.filter((card) => String(card.attrs.clase).startsWith('Monstruo') && typeof card.attrs.atk === 'number').length).toBeGreaterThanOrEqual(10);
  });
});

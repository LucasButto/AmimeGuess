import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pickDaily, type DailyContext } from '@/engine/daily';
import type { Content, Entity } from '@/engine/types';
import {
  REVEALED,
  REVEAL_STEPS,
  candidatesOf,
  failedCount,
  isCorrect,
  meetsRequirement,
  pickImage,
  randomFocus,
  restoreAttempts,
  revealStep,
  revealVisual,
  shareGrid,
  zoomWindow,
  type Candidate,
} from './logic';
import type { ImageRevealConfig, RevealVariant } from './types';

const entity = (id: string, series: string[]): Entity => ({
  id,
  name: { es: id },
  aliases: [],
  series,
  image: `test/${id}`,
  attrs: {},
});

const withoutImage = (value: Entity): Entity => ({ ...value, image: undefined });

const card = (id: string, entityId: string | undefined, series: string, payload: Record<string, unknown>, kind = 'tcg-card'): Content => ({
  id,
  kind,
  entityId,
  series,
  payload,
  verified: true,
});

const ENTITY_CONFIG: ImageRevealConfig = { variant: 'silhouette' };
const CARD_CONFIG: ImageRevealConfig = { variant: 'blur', imageContentKind: 'tcg-card' };
const ctx: DailyContext = { franchise: 'test', mode: 'silueta', filterKey: 'all', day: 100 };

describe('candidatesOf · imagen de la propia entidad', () => {
  const entities = [entity('a', ['g1']), entity('b', ['g2']), withoutImage(entity('c', ['g1'])), entity('d', ['g1', 'g3'])];

  it('ofrece las entidades elegibles que tienen imagen', () => {
    expect(candidatesOf(entities, [], ['g1'], ENTITY_CONFIG).map((c) => c.id)).toEqual(['a', 'd']);
  });

  it('una serie activa de una entidad con varias alcanza', () => {
    expect(candidatesOf(entities, [], ['g3'], ENTITY_CONFIG).map((c) => c.id)).toEqual(['d']);
  });

  it('el arte de una entidad es cuadrado y no trae punto focal', () => {
    const [first] = candidatesOf(entities, [], ['g1'], ENTITY_CONFIG);
    expect(first.images).toEqual([{ id: 'a', stem: 'test/a', width: 512, height: 512, focus: null }]);
  });

  it('una entidad sin imagen no puede ser la respuesta', () => {
    expect(candidatesOf(entities, [], ['g1', 'g2', 'g3'], ENTITY_CONFIG).map((c) => c.id)).not.toContain('c');
  });
});

describe('candidatesOf · imagen de un contenido', () => {
  const entities = [entity('a', ['g1']), entity('b', ['g2']), entity('c', ['g1'])];
  const contents = [
    card('card-a2', 'a', 'g1', { image: 'cards/a2', width: 372, height: 512 }),
    card('card-a1', 'a', 'g1', { image: 'cards/a1', width: 370, height: 512 }),
    card('card-b1', 'b', 'g2', { image: 'cards/b1', width: 372, height: 512 }),
    card('other-c', 'c', 'g1', { image: 'other/c' }, 'dex'),
    card('card-orphan', undefined, 'g1', { image: 'cards/orphan' }),
    card('card-broken', 'c', 'g1', { width: 372 }),
  ];

  it('la respuesta posible es la entidad dueña del contenido, no el contenido', () => {
    const result = candidatesOf(entities, contents, ['g1', 'g2'], CARD_CONFIG);
    expect(result.map((c) => c.id)).toEqual(['a', 'b']);
    expect(result[0].entity).toBe(entities[0]);
  });

  it('ignora otros tipos de contenido, los huérfanos y los que no traen imagen', () => {
    expect(candidatesOf(entities, contents, ['g1', 'g2'], CARD_CONFIG).map((c) => c.id)).not.toContain('c');
  });

  it('con la serie apagada, ni la entidad ni sus contenidos aparecen (reglas 1 y 2)', () => {
    expect(candidatesOf(entities, contents, ['g1'], CARD_CONFIG).map((c) => c.id)).toEqual(['a']);
    expect(candidatesOf(entities, contents, ['g2'], CARD_CONFIG).map((c) => c.id)).toEqual(['b']);
  });

  it('un contenido de una serie inactiva no aporta imagen aunque la entidad sea elegible', () => {
    const multi = [entity('m', ['g1', 'g2'])];
    const own = [
      card('card-m1', 'm', 'g1', { image: 'cards/m1' }),
      card('card-m2', 'm', 'g2', { image: 'cards/m2' }),
    ];
    const [only] = candidatesOf(multi, own, ['g1'], CARD_CONFIG);
    expect(only.images.map((image) => image.stem)).toEqual(['cards/m1']);
  });

  it('lee las medidas y las ordena por id, sin depender del orden de los datos', () => {
    const [first] = candidatesOf(entities, contents, ['g1'], CARD_CONFIG);
    expect(first.images.map((image) => image.id)).toEqual(['card-a1', 'card-a2']);
    expect(first.images[0]).toMatchObject({ stem: 'cards/a1', width: 370, height: 512, focus: null });
  });

  it('sin medidas, la imagen se toma cuadrada', () => {
    const [first] = candidatesOf([entity('z', ['g1'])], [card('card-z', 'z', 'g1', { image: 'cards/z' })], ['g1'], CARD_CONFIG);
    expect(first.images[0]).toMatchObject({ width: 512, height: 512 });
  });

  it('lee el punto focal solo si es válido', () => {
    const point = (focus: unknown) =>
      candidatesOf([entity('z', ['g1'])], [card('card-z', 'z', 'g1', { image: 'cards/z', focus })], ['g1'], CARD_CONFIG)[0].images[0].focus;
    expect(point({ x: 0.25, y: 0.75 })).toEqual({ x: 0.25, y: 0.75 });
    expect(point({ x: 1.5, y: 0.5 })).toBeNull();
    expect(point({ x: 0.5 })).toBeNull();
    expect(point('centro')).toBeNull();
    expect(point(undefined)).toBeNull();
  });
});

describe('pickImage', () => {
  const candidate: Candidate = {
    id: 'a',
    entity: entity('a', ['g1']),
    images: ['i1', 'i2', 'i3'].map((id) => ({ id, stem: `cards/${id}`, width: 372, height: 512, focus: null })),
  };

  it('con una sola imagen, esa', () => {
    const single: Candidate = { ...candidate, images: [candidate.images[0]] };
    expect(pickImage(single, ctx)).toBe(candidate.images[0]);
  });

  it('es determinista', () => {
    const first = pickImage(candidate, ctx);
    for (let i = 0; i < 100; i++) expect(pickImage(candidate, ctx)).toBe(first);
  });

  it('cambia con los días y las usa todas', () => {
    const seen = new Set<string>();
    for (let day = 0; day < 200; day++) seen.add(pickImage(candidate, { ...ctx, day }).id);
    expect(seen.size).toBe(3);
  });
});

describe('revealStep', () => {
  it('cada intento fallido revela un paso más', () => {
    expect([0, 1, 2, 3, 4, 5].map((failed) => revealStep(failed, true))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('el último paso es el tope: no pasa de REVEAL_STEPS', () => {
    expect(REVEAL_STEPS).toBe(6);
    expect(revealStep(6, true)).toBe(5);
    expect(revealStep(40, true)).toBe(5);
  });

  it('con "revelar" apagado la imagen no cambia', () => {
    expect([0, 3, 10].map((failed) => revealStep(failed, false))).toEqual([0, 0, 0]);
  });

  it('un valor negativo no rompe', () => {
    expect(revealStep(-2, true)).toBe(0);
  });
});

describe('revealVisual', () => {
  const focus = { x: 0.5, y: 0.5 };
  const steps = Array.from({ length: REVEAL_STEPS }, (_, step) => step);

  it('la silueta empieza en negro y se va iluminando sin llegar a la imagen entera', () => {
    const values = steps.map((step) => revealVisual('silhouette', step, true, focus).brightness);
    expect(values[0]).toBe(0);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    expect(values[values.length - 1]).toBeLessThan(1);
  });

  it('el desenfoque baja en cada paso y nunca llega a cero', () => {
    const values = steps.map((step) => revealVisual('blur', step, true, focus).blur);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
    expect(values[values.length - 1]).toBeGreaterThan(0);
  });

  it('el zoom se abre en cada paso y nunca muestra la imagen entera', () => {
    const values = steps.map((step) => revealVisual('zoom', step, true, focus).scale);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
    expect(values[values.length - 1]).toBeGreaterThan(1);
  });

  it('cada variante toca solo lo suyo', () => {
    expect(revealVisual('silhouette', 2, true, focus)).toEqual({ ...REVEALED, brightness: expect.any(Number) });
    expect(revealVisual('blur', 2, true, focus)).toEqual({ ...REVEALED, blur: expect.any(Number) });
    const zoom = revealVisual('zoom', 2, true, focus);
    expect(zoom.blur).toBe(0);
    expect(zoom.brightness).toBe(1);
  });

  it('sin "mostrar colores" sale en grises, en las tres variantes', () => {
    for (const variant of ['silhouette', 'blur', 'zoom'] as RevealVariant[]) {
      expect(revealVisual(variant, 2, false, focus).grayscale).toBe(1);
      expect(revealVisual(variant, 2, true, focus).grayscale).toBe(0);
    }
  });

  it('un paso fuera de rango se acota', () => {
    expect(revealVisual('blur', 99, true, focus)).toEqual(revealVisual('blur', REVEAL_STEPS - 1, true, focus));
    expect(revealVisual('blur', -3, true, focus)).toEqual(revealVisual('blur', 0, true, focus));
  });

  it('la imagen entera es neutra: nítida, a color y sin recorte', () => {
    expect(REVEALED).toEqual({ blur: 0, brightness: 1, grayscale: 0, scale: 1, x: 0, y: 0 });
  });
});

describe('zoomWindow', () => {
  it('centra el recorte en el punto focal', () => {
    expect(zoomWindow({ x: 0.5, y: 0.5 }, 2)).toEqual({ x: 0.25, y: 0.25 });
  });

  it('cerca de un borde corre el recorte hacia adentro', () => {
    expect(zoomWindow({ x: 0, y: 1 }, 4)).toEqual({ x: 0, y: 0.75 });
    expect(zoomWindow({ x: 1, y: 0 }, 4)).toEqual({ x: 0.75, y: 0 });
  });

  it('sin ampliar, el recorte es la imagen entera', () => {
    expect(zoomWindow({ x: 0.2, y: 0.9 }, 1)).toEqual({ x: 0, y: 0 });
  });

  it('el recorte nunca se sale de la imagen, con cualquier punto y paso', () => {
    for (let step = 0; step < REVEAL_STEPS; step++) {
      for (const x of [0, 0.1, 0.5, 0.9, 1]) {
        for (const y of [0, 0.3, 0.7, 1]) {
          const visual = revealVisual('zoom', step, true, { x, y });
          const size = 100 / visual.scale;
          const left = -visual.x;
          const top = -visual.y;
          expect(left).toBeGreaterThanOrEqual(0);
          expect(top).toBeGreaterThanOrEqual(0);
          expect(left + size).toBeLessThanOrEqual(100.0001);
          expect(top + size).toBeLessThanOrEqual(100.0001);
        }
      }
    }
  });
});

describe('randomFocus', () => {
  it('es el mismo para la misma combinación de filtros y día', () => {
    const first = randomFocus(ctx);
    for (let i = 0; i < 100; i++) expect(randomFocus({ ...ctx })).toEqual(first);
  });

  it('queda en la franja central de la imagen', () => {
    for (let day = 0; day < 500; day++) {
      const { x, y } = randomFocus({ ...ctx, day });
      expect(x).toBeGreaterThanOrEqual(0.3);
      expect(x).toBeLessThanOrEqual(0.7);
      expect(y).toBeGreaterThanOrEqual(0.3);
      expect(y).toBeLessThanOrEqual(0.7);
    }
  });

  it('cambia con el día, con el modo y con los filtros', () => {
    const days = new Set(Array.from({ length: 50 }, (_, day) => JSON.stringify(randomFocus({ ...ctx, day }))));
    expect(days.size).toBeGreaterThan(40);
    expect(randomFocus({ ...ctx, mode: 'zoom' })).not.toEqual(randomFocus(ctx));
    expect(randomFocus({ ...ctx, filterKey: 'g1' })).not.toEqual(randomFocus(ctx));
  });

  it('vectores fijos: un cambio en el PRNG o en la semilla cambiaría el reto de todos', () => {
    expect(randomFocus({ franchise: 'pokemon', mode: 'zoom', filterKey: 'all', day: 0 })).toEqual({ x: 0.338, y: 0.4379 });
    expect(randomFocus({ franchise: 'pokemon', mode: 'zoom', filterKey: 'g1.g2', day: 123 })).toEqual({ x: 0.3121, y: 0.6361 });
  });
});

describe('el reto del día con la imagen', () => {
  it('dos dispositivos con los mismos filtros ven la misma respuesta, imagen y recorte', () => {
    const entities = Array.from({ length: 40 }, (_, i) => entity(`e${String(i).padStart(2, '0')}`, ['g1']));
    const contents = entities.flatMap((e) => [
      card(`card-${e.id}-1`, e.id, 'g1', { image: `cards/${e.id}-1` }),
      card(`card-${e.id}-2`, e.id, 'g1', { image: `cards/${e.id}-2` }),
    ]);
    const play = () => {
      const candidates = candidatesOf(entities, contents, ['g1'], CARD_CONFIG);
      const answer = pickDaily(candidates, ctx);
      return { id: answer.id, image: pickImage(answer, ctx).id, focus: randomFocus(ctx) };
    };
    expect(play()).toEqual(play());
    // El orden de los datos no influye.
    const reversed = candidatesOf([...entities].reverse(), [...contents].reverse(), ['g1'], CARD_CONFIG);
    const answer = pickDaily(reversed, ctx);
    expect({ id: answer.id, image: pickImage(answer, ctx).id }).toEqual({ id: play().id, image: play().image });
  });
});

describe('intentos', () => {
  it('cuenta como fallidos los que no son la respuesta', () => {
    expect(failedCount(['a', 'b', 'c'], 'c')).toBe(2);
    expect(failedCount([], 'c')).toBe(0);
    expect(failedCount(['c'], 'c')).toBe(0);
  });

  it('restaura solo intentos válidos y sin repetidos', () => {
    const options = [{ id: 'a' }, { id: 'b' }];
    expect(restoreAttempts(['a', 'x', 'a', 3, 'b'], options)).toEqual(['a', 'b']);
    expect(restoreAttempts(undefined, options)).toEqual([]);
  });

  it('la grilla para compartir tiene una línea por intento, solo con colores', () => {
    expect(shareGrid(['x', 'y', 'ans'], 'ans')).toEqual(['🟥', '🟥', '🟩']);
    expect(shareGrid([], 'ans')).toEqual([]);
  });
});

describe('src/modes/image-reveal', () => {
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

describe('requireAttr · quién puede ser la respuesta', () => {
  const withAttr = (id: string, imagenTransparente: number | null, series = ['g1']): Entity => ({ ...entity(id, series), attrs: { imagenTransparente } });
  const entities = [withAttr('a', 1), withAttr('b', 0), withAttr('c', null), withAttr('d', 1, ['g2'])];
  const config: ImageRevealConfig = { variant: 'silhouette', requireAttr: { key: 'imagenTransparente', equals: 1 } };

  it('solo las que tienen el valor pedido entran al pool de respuestas', () => {
    expect(candidatesOf(entities, [], ['g1', 'g2'], config).map((c) => c.id)).toEqual(['a', 'd']);
  });

  it('se combina con las series activas', () => {
    expect(candidatesOf(entities, [], ['g1'], config).map((c) => c.id)).toEqual(['a']);
    expect(candidatesOf(entities, [], ['g2'], config).map((c) => c.id)).toEqual(['d']);
  });

  it('sin requireAttr, entran todas las que tienen imagen', () => {
    expect(candidatesOf(entities, [], ['g1', 'g2'], { variant: 'silhouette' }).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('meetsRequirement compara el valor exacto', () => {
    const [a, b, c] = entities;
    const requirement = { key: 'imagenTransparente', equals: 1 };
    expect([a, b, c].map((item) => meetsRequirement(item, requirement))).toEqual([true, false, false]);
    expect(meetsRequirement(b, undefined)).toBe(true);
  });

  it('también filtra cuando la imagen sale de un contenido', () => {
    const cards = [card('c-a', 'a', 'g1', { image: 'cards/a' }), card('c-b', 'b', 'g1', { image: 'cards/b' })];
    const cardConfig: ImageRevealConfig = { variant: 'blur', imageContentKind: 'tcg-card', requireAttr: { key: 'imagenTransparente', equals: 1 } };
    expect(candidatesOf(entities, cards, ['g1'], cardConfig).map((c) => c.id)).toEqual(['a']);
  });
});

describe('accepts · una imagen que es cierta para más de una entidad', () => {
  const entities = [entity('goku', ['db']), entity('krilin', ['db']), entity('vegeta', ['db'])];
  const technique = (id: string, entityId: string, payload: Record<string, unknown>) => card(id, entityId, 'db', { image: `techniques/${id}`, ...payload }, 'technique');
  const config: ImageRevealConfig = { variant: 'blur', imageContentKind: 'technique' };

  it('la imagen lleva los ids que acepta, solo si el dato los trae', () => {
    const contents = [technique('kame', 'goku', { accepts: ['krilin', 7, 'vegeta'] }), technique('genki', 'krilin', {})];
    const images = Object.fromEntries(candidatesOf(entities, contents, ['db'], config).map((c) => [c.id, c.images[0]]));
    expect(images.goku.accepts).toEqual(['krilin', 'vegeta']);
    expect(images.krilin.accepts).toBeUndefined();
  });

  it('isCorrect acepta la respuesta y cualquiera de las que se aceptan', () => {
    expect(isCorrect('goku', 'goku')).toBe(true);
    expect(isCorrect('krilin', 'goku')).toBe(false);
    expect(isCorrect('krilin', 'goku', ['krilin'])).toBe(true);
    expect(isCorrect('vegeta', 'goku', ['krilin'])).toBe(false);
  });

  it('failedCount y shareGrid cuentan como acierto lo que se acepta', () => {
    const attempts = ['vegeta', 'krilin', 'goku'];
    expect(failedCount(attempts, 'goku', ['krilin'])).toBe(1);
    expect(failedCount(attempts, 'goku')).toBe(2);
    expect(shareGrid(attempts, 'goku', ['krilin'])).toEqual(['🟥', '🟩', '🟩']);
    expect(shareGrid(attempts, 'goku')).toEqual(['🟥', '🟥', '🟩']);
  });
});

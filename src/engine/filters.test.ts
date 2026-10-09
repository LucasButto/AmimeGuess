import { describe, expect, it } from 'vitest';
import {
  ALL_KEY,
  buildFilterKey,
  defaultMinPool,
  eligibleContents,
  eligibleEntities,
  filterAttrValue,
  hasMinimumPool,
  inheritSeries,
  isContentEligible,
  isContentPublishable,
  isEntityEligible,
  normalizeActiveSeries,
  parseFilterKey,
  publishableContents,
} from './filters';

const POKEMON = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'];
const DRAGON_BALL = ['db', 'dbz', 'gt', 'super', 'daima'];

describe('clave de filtro', () => {
  it('es igual sin importar el orden en que se activaron las series', () => {
    const orders = [
      ['g1', 'g2', 'g3'],
      ['g1', 'g3', 'g2'],
      ['g2', 'g1', 'g3'],
      ['g2', 'g3', 'g1'],
      ['g3', 'g1', 'g2'],
      ['g3', 'g2', 'g1'],
    ];
    for (const order of orders) {
      expect(buildFilterKey(order, POKEMON)).toBe('g1.g2.g3');
    }
  });

  it('con todas las series activas es "all", en cualquier orden', () => {
    expect(ALL_KEY).toBe('all');
    expect(buildFilterKey(POKEMON, POKEMON)).toBe('all');
    expect(buildFilterKey([...POKEMON].reverse(), POKEMON)).toBe('all');
    expect(buildFilterKey(['gt', 'db', 'super', 'dbz', 'daima'], DRAGON_BALL)).toBe('all');
  });

  it('una sola serie activa', () => {
    expect(buildFilterKey(['g5'], POKEMON)).toBe('g5');
  });

  it('ignora repetidos y series que no existen', () => {
    expect(buildFilterKey(['g2', 'g2', 'g1', 'xx'], POKEMON)).toBe('g1.g2');
  });

  it('las series que se saltan se conservan en la clave', () => {
    expect(buildFilterKey(['g5', 'g1'], POKEMON)).toBe('g1.g5');
  });

  it('rechaza la combinación sin series activas (regla 7)', () => {
    expect(() => buildFilterKey([], POKEMON)).toThrow(RangeError);
    expect(() => buildFilterKey(['xx'], POKEMON)).toThrow(RangeError);
  });

  it('normalizeActiveSeries devuelve el orden canónico sin repetidos', () => {
    expect(normalizeActiveSeries(['g3', 'g1', 'g3', 'xx'], POKEMON)).toEqual(['g1', 'g3']);
  });
});

describe('parámetro s', () => {
  it('lee una lista de series', () => {
    expect(parseFilterKey('g1.g2', POKEMON)).toEqual(['g1', 'g2']);
    expect(parseFilterKey('g7', POKEMON)).toEqual(['g7']);
  });

  it('"all" son todas las series', () => {
    expect(parseFilterKey('all', POKEMON)).toEqual(POKEMON);
  });

  it('acepta cualquier orden y lo devuelve en el canónico', () => {
    expect(parseFilterKey('g3.g1', POKEMON)).toEqual(['g1', 'g3']);
  });

  it('falta o está vacío: null, para seguir con los filtros guardados', () => {
    expect(parseFilterKey(null, POKEMON)).toBeNull();
    expect(parseFilterKey(undefined, POKEMON)).toBeNull();
    expect(parseFilterKey('', POKEMON)).toBeNull();
  });

  it('con una serie desconocida o mal formado: null', () => {
    expect(parseFilterKey('g1.g99', POKEMON)).toBeNull();
    expect(parseFilterKey('g99', POKEMON)).toBeNull();
    expect(parseFilterKey('g1..g2', POKEMON)).toBeNull();
    expect(parseFilterKey('g1.', POKEMON)).toBeNull();
    expect(parseFilterKey('ALL', POKEMON)).toBeNull();
  });

  it('las series de una franquicia no valen en otra', () => {
    expect(parseFilterKey('g1', DRAGON_BALL)).toBeNull();
    expect(parseFilterKey('dbz.gt', DRAGON_BALL)).toEqual(['dbz', 'gt']);
  });

  it('ida y vuelta: parsear una clave construida devuelve las mismas series', () => {
    for (const active of [['g4'], ['g2', 'g9'], ['g9', 'g1', 'g5'], POKEMON]) {
      const key = buildFilterKey(active, POKEMON);
      expect(parseFilterKey(key, POKEMON)).toEqual(normalizeActiveSeries(active, POKEMON));
    }
  });
});

describe('elegibilidad (reglas 1 y 2)', () => {
  const goku = { id: 'goku', series: ['db', 'dbz', 'gt', 'super'] };
  const pan = { id: 'pan', series: ['gt'] };
  const beerus = { id: 'beerus', series: ['super'] };

  it('una entidad es elegible si al menos una de sus series está activa', () => {
    expect(isEntityEligible(goku, ['gt'])).toBe(true);
    expect(isEntityEligible(goku, ['db', 'daima'])).toBe(true);
    expect(isEntityEligible(pan, ['db', 'dbz', 'super', 'daima'])).toBe(false);
  });

  it('con GT apagado, Goku sigue apareciendo y Pan no', () => {
    const active = ['db', 'dbz', 'super', 'daima'];
    expect(eligibleEntities([goku, pan, beerus], active)).toEqual([goku, beerus]);
  });

  it('un contenido es elegible solo si su serie está activa', () => {
    const active = ['db', 'dbz', 'super', 'daima'];
    expect(isContentEligible({ series: 'gt' }, active)).toBe(false);
    expect(isContentEligible({ series: 'dbz' }, active)).toBe(true);
  });

  it('con GT apagado, ninguna frase o evento de GT es elegible aunque su entidad sí', () => {
    const active = ['db', 'dbz', 'super', 'daima'];
    const contents = [
      { id: 'q1', entityId: 'goku', series: 'dbz' },
      { id: 'q2', entityId: 'goku', series: 'gt' },
    ];
    expect(eligibleContents(contents, active).map((c) => c.id)).toEqual(['q1']);
  });

  it('conserva el orden y devuelve los mismos objetos', () => {
    const result = eligibleEntities([beerus, goku], ['super']);
    expect(result[0]).toBe(beerus);
    expect(result[1]).toBe(goku);
  });
});

describe('valores de atributos con serie (regla 3)', () => {
  const transformations = [
    'base',
    { value: 'ssj', series: 'dbz' },
    { value: 'ssj4', series: 'gt' },
    { value: 'ultra instinto', series: 'super' },
    { value: 'sin etiqueta' },
  ];

  it('oculta los valores de series inactivas y conserva el resto', () => {
    expect(filterAttrValue(transformations, ['db', 'dbz', 'super', 'daima'])).toEqual([
      'base',
      'ssj',
      'ultra instinto',
      'sin etiqueta',
    ]);
  });

  it('los valores sin etiqueta nunca se ocultan', () => {
    expect(filterAttrValue(transformations, ['daima'])).toEqual(['base', 'sin etiqueta']);
  });

  it('con todas las series activas deja todos los valores, sin las etiquetas', () => {
    expect(filterAttrValue(transformations, DRAGON_BALL)).toEqual([
      'base',
      'ssj',
      'ssj4',
      'ultra instinto',
      'sin etiqueta',
    ]);
  });

  it('una lista vacía queda vacía', () => {
    expect(filterAttrValue([], ['dbz'])).toEqual([]);
  });

  it('los atributos que no son listas pasan sin cambios', () => {
    expect(filterAttrValue('saiyajin', ['dbz'])).toBe('saiyajin');
    expect(filterAttrValue(1.75, ['dbz'])).toBe(1.75);
    expect(filterAttrValue(null, ['dbz'])).toBeNull();
  });

  it('no modifica el valor original', () => {
    const original = [...transformations];
    filterAttrValue(transformations, ['db']);
    expect(transformations).toEqual(original);
  });
});

describe('series heredadas (regla 4)', () => {
  const YUGIOH = ['dm', 'gx', '5ds', 'zexal', 'arcv', 'vrains'];

  it('una carta hereda la unión de las series de sus dueños, en orden canónico', () => {
    expect(inheritSeries([['vrains'], ['dm', 'gx'], ['gx']], YUGIOH)).toEqual(['dm', 'gx', 'vrains']);
  });

  it('con un solo dueño hereda sus series', () => {
    expect(inheritSeries([['5ds']], YUGIOH)).toEqual(['5ds']);
  });

  it('sin dueños no hereda ninguna', () => {
    expect(inheritSeries([], YUGIOH)).toEqual([]);
  });

  it('con gx apagado, una carta cuyos dueños son todos de gx deja de ser elegible', () => {
    const active = ['dm', '5ds', 'zexal', 'arcv', 'vrains'];
    const soloGx = { id: 'carta-a', series: inheritSeries([['gx'], ['gx']], YUGIOH) };
    const compartida = { id: 'carta-b', series: inheritSeries([['gx'], ['dm']], YUGIOH) };
    expect(eligibleEntities([soloGx, compartida], active)).toEqual([compartida]);
  });
});

describe('pool mínimo (regla 6)', () => {
  it('valores por defecto: 4 grupos para connections y 10 para el resto, el Clásico incluido', () => {
    expect(defaultMinPool('classic')).toBe(10);
    expect(defaultMinPool('connections')).toBe(4);
    for (const engine of ['image-reveal', 'text-clue', 'reveal-list', 'higher-lower', 'timeline']) {
      expect(defaultMinPool(engine)).toBe(10);
    }
  });

  it('alcanza justo en el mínimo y no por debajo', () => {
    expect(hasMinimumPool(20, 20)).toBe(true);
    expect(hasMinimumPool(19, 20)).toBe(false);
    expect(hasMinimumPool(0, 10)).toBe(false);
    expect(hasMinimumPool(500, 10)).toBe(true);
  });
});

describe('contenido sin verificar', () => {
  const content = (kind: string, verified: boolean) => ({ id: `${kind}-${verified}`, kind, verified });

  it('las frases y los sucesos solo entran al pool con verified: true', () => {
    expect(isContentPublishable(content('quote', true))).toBe(true);
    expect(isContentPublishable(content('quote', false))).toBe(false);
    expect(isContentPublishable(content('event', true))).toBe(true);
    expect(isContentPublishable(content('event', false))).toBe(false);
  });

  it('los demás tipos de contenido no dependen de verified', () => {
    expect(isContentPublishable(content('technique', false))).toBe(true);
    expect(isContentPublishable(content('dex', false))).toBe(true);
  });

  it('publishableContents conserva el orden y quita solo lo que no puede entrar', () => {
    const pool = [content('quote', false), content('technique', false), content('event', true), content('quote', true)];
    expect(publishableContents(pool).map((item) => item.id)).toEqual(['technique-false', 'event-true', 'quote-true']);
  });
});

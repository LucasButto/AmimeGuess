import { describe, expect, it } from 'vitest';
import { compareExact, compareOrdered, compareSet } from './compare';

describe('compareExact', () => {
  it('coincide si los valores son iguales', () => {
    expect(compareExact('fuego', 'fuego')).toBe('exact');
    expect(compareExact(7, 7)).toBe('exact');
  });

  it('no coincide si son distintos, incluso de distinto tipo', () => {
    expect(compareExact('fuego', 'agua')).toBe('none');
    expect(compareExact(7, '7')).toBe('none');
  });

  it('null coincide con null, pero no con un valor', () => {
    expect(compareExact(null, null)).toBe('exact');
    expect(compareExact(null, 'volador')).toBe('none');
    expect(compareExact('volador', null)).toBe('none');
  });

  it('distingue mayúsculas: los datos ya vienen normalizados', () => {
    expect(compareExact('Fuego', 'fuego')).toBe('none');
  });

  it('si alguno es una lista, solo cuenta la coincidencia total', () => {
    expect(compareExact(['a', 'b'], ['b', 'a'])).toBe('exact');
    expect(compareExact(['a', 'b'], ['a'])).toBe('none');
    expect(compareExact([], null)).toBe('exact');
  });
});

describe('compareSet', () => {
  it('exacta si tienen los mismos valores, sin importar el orden', () => {
    expect(compareSet(['humano', 'saiyajin'], ['saiyajin', 'humano'])).toBe('exact');
  });

  it('parcial si comparten algún valor pero no todos', () => {
    expect(compareSet(['humano', 'saiyajin'], ['saiyajin'])).toBe('partial');
    expect(compareSet(['saiyajin'], ['saiyajin', 'namekiano'])).toBe('partial');
    expect(compareSet(['a', 'b'], ['b', 'c'])).toBe('partial');
  });

  it('nula si no comparten ninguno', () => {
    expect(compareSet(['humano'], ['namekiano'])).toBe('none');
  });

  it('null y la lista vacía son el conjunto vacío: dos vacíos coinciden', () => {
    expect(compareSet(null, null)).toBe('exact');
    expect(compareSet([], [])).toBe('exact');
    expect(compareSet(null, [])).toBe('exact');
    expect(compareSet([], null)).toBe('exact');
  });

  it('un conjunto vacío contra uno con valores es nula', () => {
    expect(compareSet([], ['a'])).toBe('none');
    expect(compareSet(['a'], [])).toBe('none');
    expect(compareSet(null, ['a'])).toBe('none');
    expect(compareSet(['a'], null)).toBe('none');
  });

  it('ignora las etiquetas de serie: compara solo el valor', () => {
    expect(compareSet([{ value: 'ssj', series: 'dbz' }, 'base'], ['base', { value: 'ssj', series: 'dbz' }])).toBe(
      'exact',
    );
    expect(compareSet([{ value: 'ssj4', series: 'gt' }], ['ssj4'])).toBe('exact');
  });

  it('trata un valor suelto como un conjunto de un elemento', () => {
    expect(compareSet('agua', ['agua'])).toBe('exact');
    expect(compareSet('agua', ['agua', 'hielo'])).toBe('partial');
    expect(compareSet('agua', 'fuego')).toBe('none');
  });

  it('los repetidos no cuentan dos veces', () => {
    expect(compareSet(['a', 'a'], ['a'])).toBe('exact');
  });
});

describe('compareOrdered', () => {
  it('coincide si los números son iguales, sin dirección', () => {
    expect(compareOrdered(3, 3)).toEqual({ match: 'exact', direction: null });
    expect(compareOrdered(0, 0)).toEqual({ match: 'exact', direction: null });
    expect(compareOrdered(1.7, 1.7)).toEqual({ match: 'exact', direction: null });
  });

  it('si la respuesta es mayor, la flecha apunta arriba', () => {
    expect(compareOrdered(2, 5)).toEqual({ match: 'none', direction: 'up' });
    expect(compareOrdered(-4, -1)).toEqual({ match: 'none', direction: 'up' });
  });

  it('si la respuesta es menor, la flecha apunta abajo', () => {
    expect(compareOrdered(9, 4)).toEqual({ match: 'none', direction: 'down' });
    expect(compareOrdered(0.5, 0)).toEqual({ match: 'none', direction: 'down' });
  });

  it('dos null coinciden', () => {
    expect(compareOrdered(null, null)).toEqual({ match: 'exact', direction: null });
  });

  it('con un null de un solo lado no hay dirección', () => {
    expect(compareOrdered(null, 5)).toEqual({ match: 'none', direction: null });
    expect(compareOrdered(5, null)).toEqual({ match: 'none', direction: null });
  });

  it('lo que no es un número no se puede ordenar', () => {
    expect(compareOrdered('3', 3)).toEqual({ match: 'none', direction: null });
    expect(compareOrdered(3, ['3'])).toEqual({ match: 'none', direction: null });
    expect(compareOrdered([], [])).toEqual({ match: 'none', direction: null });
    expect(compareOrdered(Number.NaN, 3)).toEqual({ match: 'none', direction: null });
    expect(compareOrdered(Infinity, 3)).toEqual({ match: 'none', direction: null });
  });
});

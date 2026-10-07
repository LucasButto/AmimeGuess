import { describe, expect, it } from 'vitest';
import { resolveActiveSeries } from './useSeriesFilters';

const POKEMON = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'];

describe('resolveActiveSeries', () => {
  it('sin URL ni guardado, todas las series', () => {
    expect(resolveActiveSeries({ param: null, saved: null, canonical: POKEMON })).toEqual(POKEMON);
  });

  it('el parámetro de la URL manda sobre lo guardado', () => {
    expect(resolveActiveSeries({ param: 'g1.g2', saved: ['g5'], canonical: POKEMON })).toEqual(['g1', 'g2']);
  });

  it('"all" en la URL son todas, aunque haya algo guardado', () => {
    expect(resolveActiveSeries({ param: 'all', saved: ['g5'], canonical: POKEMON })).toEqual(POKEMON);
  });

  it('sin URL, usa lo guardado', () => {
    expect(resolveActiveSeries({ param: null, saved: ['g3', 'g1'], canonical: POKEMON })).toEqual(['g1', 'g3']);
  });

  it('un parámetro inválido se ignora y sigue con lo guardado', () => {
    expect(resolveActiveSeries({ param: 'g99', saved: ['g4'], canonical: POKEMON })).toEqual(['g4']);
    expect(resolveActiveSeries({ param: '', saved: ['g4'], canonical: POKEMON })).toEqual(['g4']);
  });

  it('un parámetro inválido y nada guardado: todas', () => {
    expect(resolveActiveSeries({ param: 'zzz', saved: null, canonical: POKEMON })).toEqual(POKEMON);
  });

  it('lo guardado con series que ya no existen se descarta; si no queda nada, todas', () => {
    expect(resolveActiveSeries({ param: null, saved: ['g1', 'g99'], canonical: POKEMON })).toEqual(['g1']);
    expect(resolveActiveSeries({ param: null, saved: ['g99'], canonical: POKEMON })).toEqual(POKEMON);
    expect(resolveActiveSeries({ param: null, saved: [], canonical: POKEMON })).toEqual(POKEMON);
  });

  it('devuelve una copia: no comparte el arreglo de series de la franquicia', () => {
    const result = resolveActiveSeries({ param: null, saved: null, canonical: POKEMON });
    expect(result).not.toBe(POKEMON);
  });
});

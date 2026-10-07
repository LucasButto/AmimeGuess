import { describe, expect, it } from 'vitest';
import { franchises, getFranchise } from './index';

describe('configs de franquicia', () => {
  it('hay 4 franquicias con slugs únicos', () => {
    expect(franchises.map((f) => f.slug)).toEqual(['pokemon', 'dragon-ball', 'naruto', 'yugioh']);
  });

  it('la cantidad de modos es 9, 9, 9 y 10', () => {
    expect(franchises.map((f) => f.modes.length)).toEqual([9, 9, 9, 10]);
  });

  it('los slugs de modo no se repiten dentro de una franquicia', () => {
    for (const franchise of franchises) {
      const slugs = franchise.modes.map((m) => m.slug);
      expect(new Set(slugs).size, franchise.slug).toBe(slugs.length);
    }
  });

  it('las series están en el orden canónico de la SPEC 3.1', () => {
    expect(getFranchise('pokemon')?.series).toEqual(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9']);
    expect(getFranchise('dragon-ball')?.series).toEqual(['db', 'dbz', 'gt', 'super', 'daima']);
    expect(getFranchise('naruto')?.series).toEqual(['naruto', 'shippuden', 'boruto']);
    expect(getFranchise('yugioh')?.series).toEqual(['dm', 'gx', '5ds', 'zexal', 'arcv', 'vrains']);
  });

  it('Duelista es el primer modo de Yu-Gi-Oh', () => {
    expect(getFranchise('yugioh')?.modes[0]?.slug).toBe('duelista');
  });

  it('getFranchise devuelve undefined si no existe', () => {
    expect(getFranchise('inexistente')).toBeUndefined();
  });
});

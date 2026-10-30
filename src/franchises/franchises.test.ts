import { describe, expect, it } from 'vitest';
import { allFranchises as franchises, getFranchise } from './index';

describe('configs de franquicia', () => {
  it('hay 4 franquicias con slugs únicos', () => {
    expect(franchises.map((f) => f.slug)).toEqual(['pokemon', 'dragon-ball', 'naruto', 'yugioh']);
  });

  it('la cantidad de modos es 8, 8, 10 y 11, con Estadísticas en Pokémon', () => {
    expect(franchises.map((f) => f.modes.length)).toEqual([8, 8, 10, 11]);
  });

  it('los slugs de modo no se repiten dentro de una franquicia', () => {
    for (const franchise of franchises) {
      const slugs = franchise.modes.map((m) => m.slug);
      expect(new Set(slugs).size, franchise.slug).toBe(slugs.length);
    }
  });

  it('las series están en el orden canónico de la SPEC 3.1', () => {
    expect(franchises.find((f) => f.slug === 'pokemon')?.series).toEqual(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9']);
    expect(franchises.find((f) => f.slug === 'dragon-ball')?.series).toEqual(['db', 'dbz', 'daima', 'super', 'gt']);
    expect(franchises.find((f) => f.slug === 'naruto')?.series).toEqual(['naruto', 'shippuden', 'boruto']);
    expect(franchises.find((f) => f.slug === 'yugioh')?.series).toEqual(['dm', 'gx', '5ds']);
  });

  it('Duelista es el primer modo de Yu-Gi-Oh', () => {
    expect(franchises.find((f) => f.slug === 'yugioh')?.modes[0]?.slug).toBe('duelista');
  });

  it('getFranchise devuelve undefined si no existe', () => {
    expect(getFranchise('inexistente')).toBeUndefined();
  });
});

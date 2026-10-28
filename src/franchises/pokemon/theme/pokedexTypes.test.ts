import { describe, expect, it } from 'vitest';
import { pokedexTypes } from './pokedexTypes';

describe('tipos de una celda de la Pokédex', () => {
  const item = { id: 'opcion', label: 'Opción' };

  it('conserva el orden tipo 1 y tipo 2', () => {
    expect(pokedexTypes({ ...item, attrs: { tipo1: 'Planta', tipo2: 'Veneno' } })).toEqual(['Planta', 'Veneno']);
  });
  it('omite segundo tipo ausente o nulo', () => {
    expect(pokedexTypes({ ...item, attrs: { tipo1: 'Fuego' } })).toEqual(['Fuego']);
    expect(pokedexTypes({ ...item, attrs: { tipo1: 'Fuego', tipo2: null } })).toEqual(['Fuego']);
    expect(pokedexTypes(item)).toEqual([]);
  });
  it('no duplica los tipos', () => {
    expect(pokedexTypes({ ...item, attrs: { tipo1: 'Acero', tipo2: 'Acero' } })).toEqual(['Acero']);
  });
  it('omite valores vacíos, desconocidos o de otro formato', () => {
    expect(pokedexTypes({ ...item, attrs: { tipo1: '', tipo2: 'desconocido' } })).toEqual([]);
    expect(pokedexTypes({ ...item, attrs: { tipo1: 1, tipo2: ['Agua'] } })).toEqual([]);
  });
});

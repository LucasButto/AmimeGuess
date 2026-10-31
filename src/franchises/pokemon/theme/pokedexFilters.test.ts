import { describe, expect, it } from 'vitest';
import type { AutocompleteItem } from '@/components/Autocomplete';
import { MONOTYPE_FILTER, availableGenerations, availableTypes, filterByFacets } from './pokedexFilters';

const items: AutocompleteItem[] = [
  { id: 'bulbasaur', label: 'Bulbasaur', number: 1, attrs: { generacion: 1, tipo1: 'Planta', tipo2: 'Veneno' } },
  { id: 'charmander', label: 'Charmander', number: 4, attrs: { generacion: 1, tipo1: 'Fuego', tipo2: null } },
  { id: 'chikorita', label: 'Chikorita', number: 152, aliases: ['Chicorita'], attrs: { generacion: 2, tipo1: 'Planta' } },
  { id: 'gastly', label: 'Gastly', number: 92, attrs: { generacion: 1, tipo1: 'Fantasma', tipo2: 'Veneno' } },
];
const none = { generations: [], types: [] };
const ids = (result: AutocompleteItem[]) => result.map(({ id }) => id);

describe('facetas de la Pokédex', () => {
  it('sin filtros conserva todos los items en orden nacional y sin mutarlos', () => {
    expect(ids(filterByFacets(items, none))).toEqual(['bulbasaur', 'charmander', 'gastly', 'chikorita']);
    expect(items[2].id).toBe('chikorita');
  });

  it('ofrece solo generaciones y tipos presentes, ordenados y sin duplicados', () => {
    expect(availableGenerations(items)).toEqual([1, 2]);
    expect(availableTypes(items)).toEqual(['Fantasma', 'Fuego', 'Planta', 'Veneno']);
    expect(availableGenerations([items[2]])).toEqual([2]);
    expect(availableTypes([items[2]])).toEqual(['Planta']);
    expect(availableTypes([])).toEqual([]);
  });

  it('filtra por generación, con OR entre generaciones', () => {
    expect(ids(filterByFacets(items, { ...none, generations: [2] }))).toEqual(['chikorita']);
    expect(filterByFacets(items, { ...none, generations: [1, 2] })).toHaveLength(4);
  });

  it('acepta tipo 1 o tipo 2 y OR entre los tipos elegidos', () => {
    expect(ids(filterByFacets(items, { ...none, types: ['Planta'] }))).toEqual(['bulbasaur', 'chikorita']);
    expect(ids(filterByFacets(items, { ...none, types: ['Veneno'] }))).toEqual(['bulbasaur', 'gastly']);
    expect(ids(filterByFacets(items, { ...none, types: ['Veneno', 'Fuego'] }))).toEqual(['bulbasaur', 'charmander', 'gastly']);
  });

  it('combina generación Y tipo', () => {
    expect(ids(filterByFacets(items, { generations: [2], types: ['Planta'] }))).toEqual(['chikorita']);
  });

  it('combina las facetas con búsqueda por nombre, alias o número', () => {
    const filters = { generations: [1, 2], types: ['Planta'] };
    expect(ids(filterByFacets(items, filters, 'bulba'))).toEqual(['bulbasaur']);
    expect(ids(filterByFacets(items, filters, 'chicorita'))).toEqual(['chikorita']);
    expect(ids(filterByFacets(items, filters, '001'))).toEqual(['bulbasaur', 'chikorita']);
    expect(filterByFacets(items, filters, 'charmander')).toEqual([]);
  });

  it('tolera tipo 2 ausente o nulo y atributos ausentes', () => {
    expect(ids(filterByFacets(items, { ...none, types: ['Fuego'] }))).toEqual(['charmander']);
    const legacy = { id: 'legacy', label: 'Legacy' };
    expect(filterByFacets([legacy], none)).toEqual([legacy]);
    expect(filterByFacets([legacy], { ...none, types: ['Planta'] })).toEqual([]);
  });

  it('permite resultados vacíos', () => {
    expect(filterByFacets(items, { generations: [2], types: ['Fuego'] })).toEqual([]);
  });

  it('no duplica un Pokémon que coincide con dos tipos elegidos', () => {
    expect(ids(filterByFacets(items, { ...none, types: ['Planta', 'Veneno'] })))
      .toEqual(['bulbasaur', 'gastly', 'chikorita']);
  });

  it('el guion deja solo los Pokémon sin tipo secundario, dentro de los tipos elegidos', () => {
    const mono = filterByFacets(items, { ...none, types: [MONOTYPE_FILTER] });
    expect(mono.length).toBeGreaterThan(0);
    expect(mono.every(({ attrs }) => !attrs?.tipo2)).toBe(true);
    expect(ids(filterByFacets(items, { ...none, types: [MONOTYPE_FILTER, 'Veneno'] }))).toEqual([]);
    expect(ids(filterByFacets(items, { ...none, types: [MONOTYPE_FILTER, 'Planta', 'Veneno'] }))).toEqual(['chikorita']);
  });
});

it('matches exact type combinations regardless of order and respects generation/search', () => {
  const exact = { generations: [], types: ['Veneno', 'Planta'], exactTypes: true };
  expect(ids(filterByFacets(items, exact))).toEqual(['bulbasaur']);
  expect(filterByFacets(items, { ...exact, generations: [2] })).toEqual([]);
  expect(filterByFacets(items, exact, 'gast')).toEqual([]);
  expect(ids(filterByFacets(items, { ...exact, types: ['Planta'] }))).toEqual(['chikorita']);
  expect(filterByFacets(items, { ...exact, types: ['Planta', 'Veneno', 'Fuego'] })).toEqual([]);
});

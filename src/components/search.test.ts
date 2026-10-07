import { describe, expect, it } from 'vitest';
import { buildSearchIndex, normalizeSearch, search } from './search';

const items = [
  { id: 'bulbasaur', label: 'Bulbasaur' },
  { id: 'charmander', label: 'Charmander', aliases: ['Salamèche'] },
  { id: 'mr-mime', label: 'Mr. Mime', aliases: ['mr-mime'] },
  { id: 'farfetchd', label: 'Farfetch’d', aliases: ["Farfetch'd", 'farfetchd'] },
  { id: 'flabebe', label: 'Flabébé' },
  { id: 'nidoran-f', label: 'Nidoran♀', aliases: ['nidoran-f'] },
  { id: 'mime-jr', label: 'Mime Jr.', aliases: ['mime-jr'] },
  { id: 'pikachu', label: 'Pikachu' },
  { id: 'pichu', label: 'Pichu' },
  { id: 'raichu', label: 'Raichu', aliases: ['Raichu de Alola'] },
];
const index = buildSearchIndex(items);
const ids = (query: string, options = {}) => search(index, query, options).map((item) => item.id);

describe('normalizeSearch', () => {
  it('ignora mayúsculas, acentos, signos y espacios', () => {
    expect(normalizeSearch('Mr. Mime')).toBe('mrmime');
    expect(normalizeSearch('MRMIME')).toBe('mrmime');
    expect(normalizeSearch('  Flabébé ')).toBe('flabebe');
    expect(normalizeSearch("Farfetch’d")).toBe('farfetchd');
    expect(normalizeSearch("Farfetch'd")).toBe('farfetchd');
  });

  it('conserva letras y números de cualquier idioma', () => {
    expect(normalizeSearch('5D’s')).toBe('5ds');
    expect(normalizeSearch('Привет')).toBe('привет');
    expect(normalizeSearch('ポケモン')).toBe(normalizeSearch('ポケモン'));
  });

  it('un texto sin letras ni números queda vacío', () => {
    expect(normalizeSearch(' .-♀ ')).toBe('');
  });
});

describe('search', () => {
  it('no distingue mayúsculas ni acentos', () => {
    expect(ids('FLABEBE')).toEqual(['flabebe']);
    expect(ids('flabébé')).toEqual(['flabebe']);
    expect(ids('bulba')).toEqual(['bulbasaur']);
  });

  it('con el texto vacío no ofrece nada', () => {
    expect(ids('')).toEqual([]);
    expect(ids('   ')).toEqual([]);
    expect(ids('...')).toEqual([]);
  });

  it('encuentra nombres con puntuación y espacios escritos de cualquier forma', () => {
    expect(ids('mr mime')).toContain('mr-mime');
    expect(ids('mr. mime')).toContain('mr-mime');
    expect(ids('mrmime')).toContain('mr-mime');
    expect(ids('farfetch')).toEqual(['farfetchd']);
    expect(ids("farfetch'd")).toEqual(['farfetchd']);
    expect(ids('nidoran')).toEqual(['nidoran-f']);
  });

  it('encuentra por alias', () => {
    expect(ids('salamech')).toEqual(['charmander']);
    expect(ids('raichu de alola')).toEqual(['raichu']);
  });

  it('ordena: primero los que empiezan igual, después una palabra, después los que lo contienen', () => {
    // "mime": empieza con Mime Jr.; es una palabra de Mr. Mime.
    expect(ids('mime')).toEqual(['mime-jr', 'mr-mime']);
    // "chu": lo contienen Pikachu, Pichu (no: "pichu" contiene "chu") y Raichu.
    expect(ids('chu')).toEqual(['pichu', 'pikachu', 'raichu']);
    // "pi": empiezan Pichu y Pikachu; lo contienen otros.
    expect(ids('pi')[0]).toBe('pichu');
    expect(ids('pi').slice(0, 2)).toEqual(['pichu', 'pikachu']);
  });

  it('un nombre que coincide sale antes que un alias que coincide igual', () => {
    const list = buildSearchIndex([
      { id: 'a', label: 'Zeta', aliases: ['Alfa'] },
      { id: 'b', label: 'Alfonso' },
    ]);
    expect(search(list, 'alf').map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('excluye los ids indicados', () => {
    expect(ids('pi', { exclude: new Set(['pichu']) })).not.toContain('pichu');
    expect(ids('pikachu', { exclude: new Set(['pikachu']) })).toEqual([]);
  });

  it('limita la cantidad de resultados, conservando los mejores', () => {
    const limited = ids('i', { limit: 3 });
    expect(limited).toHaveLength(3);
    expect(limited).toEqual(ids('i').slice(0, 3));
  });

  it('devuelve los mismos objetos que se le dieron', () => {
    expect(search(index, 'pikachu')[0]).toBe(items[7]);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(ids('zzzz')).toEqual([]);
  });
});

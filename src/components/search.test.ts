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

  it('solo ofrece lo que empieza igual: no lo que contiene el texto en el medio, al final ni en otra palabra', () => {
    // "chu": Pichu, Pikachu y Raichu lo llevan al final, pero ninguno empieza con "chu".
    expect(ids('chu')).toEqual([]);
    // "mime": Mime Jr. empieza igual; Mr. Mime lleva "mime" como segunda palabra y no entra.
    expect(ids('mime')).toEqual(['mime-jr']);
    // "m": empiezan Mime Jr. y Mr. Mime; Charmander lleva una M adentro y no entra.
    expect(ids('m')).toEqual(['mime-jr', 'mr-mime']);
  });

  it('con una letra, ofrece solo los que empiezan con esa letra, aunque otros la lleven', () => {
    // Regresión: "S" mostraba Metagross y otros por llevar una S dentro del nombre.
    const names = ['Snorunt', 'Metagross', 'Sandshrew', 'Pikachu', 'Gyarados', 'Starmie', 'Charizard'];
    const list = buildSearchIndex(names.map((label) => ({ id: label.toLowerCase(), label })));
    expect(search(list, 's').map((item) => item.label)).toEqual(['Sandshrew', 'Snorunt', 'Starmie']);
  });

  it('los alias no cuentan con una sola letra: "s" no trae a quien solo se llama así en otro idioma', () => {
    const list = buildSearchIndex([
      { id: 'colagrito', label: 'Colagrito', aliases: ['Scream Tail'] },
      { id: 'snorunt', label: 'Snorunt' },
    ]);
    expect(search(list, 's').map((item) => item.id)).toEqual(['snorunt']);
    expect(search(list, 'sc').map((item) => item.id)).toEqual(['colagrito']);
  });

  it('ordena alfabéticamente y deja los alias después de los nombres', () => {
    expect(ids('p').slice(0, 2)).toEqual(['pichu', 'pikachu']);
    const list = buildSearchIndex([
      { id: 'a', label: 'Zeta', aliases: ['Alfa'] },
      { id: 'b', label: 'Alfonso' },
      { id: 'c', label: 'Alberto' },
    ]);
    expect(search(list, 'al').map((item) => item.id)).toEqual(['c', 'b', 'a']);
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
    const limited = ids('m', { limit: 1 });
    expect(limited).toEqual(ids('m').slice(0, 1));
  });

  it('con una sola letra y sin límite devuelve todas las coincidencias, no solo las primeras', () => {
    // Regresión: el desplegable cortaba en 8 y "S" no mostraba a Snorunt hasta escribir "SN".
    const names = ['Sandshrew', 'Scyther', 'Seel', 'Shellder', 'Slowpoke', 'Snorlax', 'Spearow', 'Squirtle', 'Starmie', 'Snorunt'];
    const many = buildSearchIndex(names.map((label) => ({ id: label.toLowerCase(), label })));
    const found = search(many, 's').map((item) => item.id);
    expect(found).toHaveLength(names.length);
    expect(found).toContain('snorunt');
  });

  it('devuelve los mismos objetos que se le dieron', () => {
    expect(search(index, 'pikachu')[0]).toBe(items[7]);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(ids('zzzz')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import type { Content, Entity } from '@/engine/types';
import {
  buildRow,
  cellText,
  failedCount,
  formatValue,
  hintStates,
  hintText,
  restoreAttempts,
  shareGrid,
  visibleColumns,
} from './logic';
import type { ClassicColumn, ClassicHint } from './types';

const columns: ClassicColumn[] = [
  { key: 'tipo1', label: 'Tipo 1', compare: 'exact' },
  { key: 'tipo2', label: 'Tipo 2', compare: 'exact' },
  { key: 'altura', label: 'Altura', compare: 'ordered', unit: 'm' },
  { key: 'huevo', label: 'Grupo huevo', compare: 'set' },
  { key: 'habitat', label: 'Hábitat', compare: 'exact', onlyForSeries: ['g1', 'g2', 'g3'] },
];

const entity = (id: string, attrs: Entity['attrs'], series = ['g1']): Entity => ({
  id,
  name: { es: id },
  aliases: [],
  series,
  attrs,
});

const bulbasaur = entity('bulbasaur', { tipo1: 'Planta', tipo2: 'Veneno', altura: 0.7, huevo: ['Monstruo', 'Planta'], habitat: 'Pradera' });
const ivysaur = entity('ivysaur', { tipo1: 'Planta', tipo2: 'Veneno', altura: 1, huevo: ['Monstruo', 'Planta'], habitat: 'Pradera' });
const charmander = entity('charmander', { tipo1: 'Fuego', tipo2: null, altura: 0.6, huevo: ['Monstruo', 'Dragón'], habitat: 'Montaña' });
const squirtle = entity('squirtle', { tipo1: 'Agua', tipo2: null, altura: 0.5, huevo: ['Campo'], habitat: null });

describe('visibleColumns', () => {
  const ids = (active: string[]) => visibleColumns(columns, active).map((column) => column.key);

  it('las columnas comunes se muestran siempre', () => {
    expect(ids(['g1'])).toEqual(['tipo1', 'tipo2', 'altura', 'huevo', 'habitat']);
    expect(ids(['g9'])).toEqual(['tipo1', 'tipo2', 'altura', 'huevo']);
  });

  it('una columna condicional aparece solo si todas las series activas están en su lista', () => {
    expect(ids(['g1', 'g2', 'g3'])).toContain('habitat');
    expect(ids(['g2'])).toContain('habitat');
    expect(ids(['g1', 'g3'])).toContain('habitat');
  });

  it('con una sola serie fuera de la lista, la columna se oculta', () => {
    expect(ids(['g1', 'g4'])).not.toContain('habitat');
    expect(ids(['g4'])).not.toContain('habitat');
    expect(ids(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'])).not.toContain('habitat');
  });

  it('conserva el orden de las columnas', () => {
    expect(ids(['g1'])).toEqual(columns.map((column) => column.key));
  });
});

describe('buildRow', () => {
  const row = (guess: Entity, answer: Entity, active = ['g1']) => buildRow(guess, answer, columns, active);
  const matches = (guess: Entity, answer: Entity) => row(guess, answer).cells.map((cell) => cell.match);

  it('un intento igual a la respuesta coincide en todo', () => {
    expect(matches(bulbasaur, bulbasaur)).toEqual(['exact', 'exact', 'exact', 'exact', 'exact']);
  });

  it('compara cada columna según su tipo', () => {
    // vs Ivysaur: altura distinta; el resto igual.
    expect(matches(bulbasaur, ivysaur)).toEqual(['exact', 'exact', 'none', 'exact', 'exact']);
    // vs Charmander: tipos distintos, grupo huevo parcial (Monstruo en común).
    expect(matches(bulbasaur, charmander)).toEqual(['none', 'none', 'none', 'partial', 'none']);
  });

  it('en una columna ordenable indica hacia dónde está la respuesta', () => {
    const toIvysaur = row(bulbasaur, ivysaur).cells[2];
    expect(toIvysaur.direction).toBe('up');
    const toCharmander = row(bulbasaur, charmander).cells[2];
    expect(toCharmander.direction).toBe('down');
    expect(row(bulbasaur, bulbasaur).cells[2].direction).toBeNull();
  });

  it('las columnas que no son ordenables nunca llevan flecha', () => {
    for (const cell of row(bulbasaur, charmander).cells) {
      if (cell.column.compare !== 'ordered') expect(cell.direction).toBeNull();
    }
  });

  it('dos null coinciden: sin segundo tipo contra sin segundo tipo', () => {
    expect(row(charmander, squirtle).cells[1].match).toBe('exact');
    expect(row(charmander, bulbasaur).cells[1].match).toBe('none');
  });

  it('un atributo que falta cuenta como null', () => {
    const incomplete = entity('x', { tipo1: 'Planta' });
    const cells = row(incomplete, bulbasaur).cells;
    expect(cells[1].value).toBeNull();
    expect(cells[1].match).toBe('none');
  });

  it('devuelve una celda por columna y la entidad del intento', () => {
    const result = row(bulbasaur, charmander);
    expect(result.entity).toBe(bulbasaur);
    expect(result.cells.map((cell) => cell.column)).toEqual(columns);
  });

  it('oculta los valores de series inactivas antes de comparar (regla 3)', () => {
    const tagged = [{ value: 'Forma base' }, { value: 'Forma de GT', series: 'gt' }];
    const withGt = entity('goku', { formas: tagged });
    const withoutGt = entity('vegeta', { formas: ['Forma base'] });
    const formas: ClassicColumn[] = [{ key: 'formas', label: 'Formas', compare: 'set' }];

    // Con GT activo no coinciden del todo; sin GT, sí.
    expect(buildRow(withGt, withoutGt, formas, ['dbz', 'gt']).cells[0].match).toBe('partial');
    expect(buildRow(withGt, withoutGt, formas, ['dbz']).cells[0].match).toBe('exact');
    expect(buildRow(withGt, withoutGt, formas, ['dbz']).cells[0].value).toEqual(['Forma base']);
  });
});

describe('shareGrid', () => {
  const build = (guess: Entity, answer: Entity) => buildRow(guess, answer, columns, ['g1']);

  it('un cuadrado de color por columna: verde, naranja o rojo', () => {
    // bulbasaur vs charmander: tipo1 ✕, tipo2 ✕, altura ✕, huevo parcial, hábitat ✕
    expect(shareGrid([build(bulbasaur, charmander)])).toEqual(['🟥🟥🟥🟧🟥']);
    expect(shareGrid([build(bulbasaur, bulbasaur)])).toEqual(['🟩🟩🟩🟩🟩']);
  });

  it('una línea por intento, en el orden en que se jugaron', () => {
    const grid = shareGrid([build(charmander, bulbasaur), build(ivysaur, bulbasaur), build(bulbasaur, bulbasaur)]);
    expect(grid).toHaveLength(3);
    expect(grid[2]).toBe('🟩🟩🟩🟩🟩');
    expect(grid[0]).not.toBe(grid[2]);
  });

  it('todas las líneas tienen tantos cuadrados como columnas', () => {
    for (const line of shareGrid([build(bulbasaur, charmander), build(squirtle, bulbasaur)])) {
      expect(Array.from(line)).toHaveLength(columns.length);
    }
  });

  it('solo contiene los tres emojis de color: ni nombres, ni valores, ni flechas', () => {
    const grid = shareGrid([build(bulbasaur, charmander), build(charmander, bulbasaur), build(ivysaur, squirtle)]);
    for (const line of grid) expect(line).toMatch(/^[🟩🟧🟥]+$/u);
    const text = grid.join('\n');
    for (const secret of ['bulbasaur', 'charmander', 'Planta', 'Fuego', '↑', '↓']) expect(text).not.toContain(secret);
  });

  it('sin intentos, grilla vacía', () => {
    expect(shareGrid([])).toEqual([]);
  });
});

describe('pistas', () => {
  const hints: ClassicHint[] = [
    { kind: 'attr', label: 'Habilidad', after: 4, key: 'habilidad' },
    { kind: 'content', label: 'Descripción', after: 10, contentKind: 'dex', field: 'text' },
  ];

  it('failedCount cuenta los intentos que no son la respuesta', () => {
    expect(failedCount([], 'a')).toBe(0);
    expect(failedCount(['b', 'c', 'd'], 'a')).toBe(3);
    expect(failedCount(['b', 'c', 'a'], 'a')).toBe(2);
  });

  it('se desbloquean justo al llegar a su cantidad de fallos', () => {
    const unlocked = (failed: number) => hintStates(hints, failed).map((state) => state.unlocked);
    expect(unlocked(0)).toEqual([false, false]);
    expect(unlocked(3)).toEqual([false, false]);
    expect(unlocked(4)).toEqual([true, false]);
    expect(unlocked(9)).toEqual([true, false]);
    expect(unlocked(10)).toEqual([true, true]);
    expect(unlocked(30)).toEqual([true, true]);
  });

  it('informa cuántos fallos faltan', () => {
    expect(hintStates(hints, 1).map((state) => state.remaining)).toEqual([3, 9]);
    expect(hintStates(hints, 4).map((state) => state.remaining)).toEqual([0, 6]);
    expect(hintStates(hints, 99).map((state) => state.remaining)).toEqual([0, 0]);
  });

  it('el texto de una pista de atributo sale del atributo de la respuesta', () => {
    const answer = entity('bulbasaur', { habilidad: 'Espesura' });
    expect(hintText(hints[0], answer, [])).toBe('Espesura');
    expect(hintText(hints[0], entity('x', {}), [])).toBeNull();
  });

  it('el texto de una pista de contenido sale del contenido de esa entidad y ese tipo', () => {
    const answer = entity('bulbasaur', {});
    const contents: Content[] = [
      { id: 'dex-ivysaur', kind: 'dex', entityId: 'ivysaur', series: 'g1', payload: { text: 'Otra.' }, verified: true },
      { id: 'dex-bulbasaur', kind: 'dex', entityId: 'bulbasaur', series: 'g1', payload: { text: 'Una semilla.' }, verified: true },
    ];
    expect(hintText(hints[1], answer, contents)).toBe('Una semilla.');
  });

  it('una pista de contenido sin contenido para la respuesta es null', () => {
    expect(hintText(hints[1], entity('mew', {}), [])).toBeNull();
    const wrongKind: Content[] = [
      { id: 'c', kind: 'tcg-card', entityId: 'mew', series: 'g1', payload: { text: 'x' }, verified: true },
    ];
    expect(hintText(hints[1], entity('mew', {}), wrongKind)).toBeNull();
    const emptyField: Content[] = [
      { id: 'c', kind: 'dex', entityId: 'mew', series: 'g1', payload: { text: '' }, verified: true },
    ];
    expect(hintText(hints[1], entity('mew', {}), emptyField)).toBeNull();
  });
});

describe('formatValue', () => {
  it('texto y números, con coma decimal y unidad', () => {
    expect(formatValue('Planta')).toBe('Planta');
    expect(formatValue(0.7, 'm')).toBe('0,7 m');
    expect(formatValue(6.9, 'kg')).toBe('6,9 kg');
    expect(formatValue(1)).toBe('1');
    expect(formatValue(303, 'kg')).toBe('303 kg');
  });

  it('las listas se unen con coma', () => {
    expect(formatValue(['Monstruo', 'Planta'])).toBe('Monstruo, Planta');
    expect(formatValue([{ value: 'SSJ', series: 'dbz' }, 'Base'])).toBe('SSJ, Base');
  });

  it('sin valor: null', () => {
    expect(formatValue(null)).toBeNull();
    expect(formatValue([])).toBeNull();
    expect(formatValue(null, 'm')).toBeNull();
  });

  it('redondea los decimales largos', () => {
    expect(formatValue(1.23456, 'm')).toBe('1,23 m');
  });
});

describe('restoreAttempts', () => {
  const pool = [bulbasaur, ivysaur, charmander];

  it('conserva los intentos válidos y su orden', () => {
    expect(restoreAttempts(['charmander', 'bulbasaur'], pool)).toEqual(['charmander', 'bulbasaur']);
  });

  it('descarta repetidos, ids que ya no existen y valores que no son texto', () => {
    expect(restoreAttempts(['bulbasaur', 'bulbasaur', 'mew', 3, null, { id: 'x' }, 'ivysaur'], pool)).toEqual([
      'bulbasaur',
      'ivysaur',
    ]);
  });

  it('sin nada guardado, ningún intento', () => {
    expect(restoreAttempts(undefined, pool)).toEqual([]);
    expect(restoreAttempts([], pool)).toEqual([]);
  });

  it('descarta los intentos que quedaron fuera del pool por un filtro', () => {
    expect(restoreAttempts(['squirtle', 'bulbasaur'], pool)).toEqual(['bulbasaur']);
  });
});

describe('columnas con etiquetas (valueLabels)', () => {
  // El valor es el lugar en la cronología; el texto, el nombre de la serie, y cada una pertenece a la suya.
  const debut: ClassicColumn = {
    key: 'debut',
    label: 'Serie de debut',
    compare: 'ordered',
    valueLabels: { '1': { label: 'Dragon Ball', series: 'db' }, '2': { label: 'Dragon Ball Z', series: 'dbz' }, '3': { label: 'Dragon Ball Super', series: 'super' } },
  };
  const one = (id: string, debutValue: number, series = ['db', 'dbz', 'super']) => entity(id, { debut: debutValue }, series);
  const goku = one('goku', 1);
  const vegeta = one('vegeta', 2);
  const bills = one('bills', 3);
  const row = (guess: Entity, answer: Entity, active: string[]) => buildRow(guess, answer, [debut], active).cells[0];

  it('se muestra el texto en lugar del número, y se compara el número', () => {
    expect(cellText(debut, 2)).toBe('Dragon Ball Z');
    const cell = row(goku, bills, ['db', 'dbz', 'super']);
    expect(cell.value).toBe(1);
    expect(cell.match).toBe('none');
    expect(cell.direction).toBe('up');
    expect(row(vegeta, vegeta, ['db', 'dbz', 'super']).match).toBe('exact');
  });

  it('un número sin etiqueta se muestra como número', () => {
    expect(cellText(debut, 9)).toBe('9');
    expect(cellText(debut, null)).toBeNull();
  });

  it('una columna sin etiquetas se comporta como siempre', () => {
    expect(cellText({ key: 'altura', label: 'Altura', compare: 'ordered', unit: 'm' }, 0.7)).toBe('0,7 m');
  });

  it('con la serie del valor inactiva, el valor del intento se oculta y no se compara', () => {
    const cell = row(vegeta, bills, ['db', 'super']);
    expect(cell.hidden).toBe(true);
    expect(cell.value).toBeNull();
    expect(cell.match).toBe('none');
    expect(cell.direction).toBeNull();
  });

  it('si el valor de la respuesta está oculto no hay flecha ni acierto, pero el intento se ve', () => {
    const cell = row(bills, vegeta, ['db', 'super']);
    expect(cell.hidden).toBeUndefined();
    expect(cell.value).toBe(3);
    expect(cell.match).toBe('none');
    expect(cell.direction).toBeNull();
  });

  it('si los dos están ocultos tampoco coinciden: no hay nada que comparar', () => {
    expect(row(vegeta, vegeta, ['db', 'super']).match).toBe('none');
  });

  it('con todas las series activas nunca hay nada oculto', () => {
    for (const guess of [goku, vegeta, bills]) expect(row(guess, bills, ['db', 'dbz', 'super']).hidden).toBeUndefined();
  });

  it('un valor sin serie en su etiqueta no se oculta nunca', () => {
    const open: ClassicColumn = { key: 'debut', label: 'Debut', compare: 'ordered', valueLabels: { '1': { label: 'Uno' } } };
    const cell = buildRow(one('a', 1), one('b', 1), [open], ['db']).cells[0];
    expect(cell.hidden).toBeUndefined();
    expect(cell.match).toBe('exact');
  });
});

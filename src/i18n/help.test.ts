import { describe, expect, it } from 'vitest';
import { franchises } from '@/franchises';
import { es } from './es';

/** Todos los textos de un objeto, con su ruta (las funciones no: son armadores de etiquetas). */
function texts(value: unknown, path: string): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => texts(child, `${path}.${key}`));
}

describe('ayudas ⓘ', () => {
  it('cada texto de es.help tiene 140 caracteres o menos (SPEC 9.2)', () => {
    const all = texts(es.help, 'help');
    expect(all.length).toBeGreaterThan(10);
    for (const [path, text] of all) expect(text.length, path).toBeLessThanOrEqual(140);
  });

  it('la ayuda de cada columna del Clásico, si la tiene, también', () => {
    for (const franchise of franchises) {
      for (const mode of franchise.modes) {
        for (const column of mode.classic?.columns ?? []) {
          if (column.help !== undefined) expect(column.help.length, `${franchise.slug}/${column.key}`).toBeLessThanOrEqual(140);
        }
      }
    }
  });

  it('las siete columnas del Clásico de Dragon Ball explican cómo se comparan', () => {
    const dragonBall = franchises.find((franchise) => franchise.slug === 'dragon-ball');
    const columns = dragonBall?.modes.find((mode) => mode.slug === 'clasico')?.classic?.columns ?? [];
    expect(columns).toHaveLength(7);
    for (const column of columns) expect(column.help, column.key).toBeTruthy();
  });

  it('las ocho columnas del Clásico de Pokémon (y la de hábitat) explican cómo se comparan', () => {
    const pokemon = franchises.find((franchise) => franchise.slug === 'pokemon');
    const columns = pokemon?.modes.find((mode) => mode.slug === 'clasico')?.classic?.columns ?? [];
    expect(columns.length).toBeGreaterThanOrEqual(8);
    for (const column of columns) expect(column.help, column.key).toBeTruthy();
  });
});

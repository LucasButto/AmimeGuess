import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { compile } from 'sass';
import { isValidElement, type ReactNode } from 'react';
import { DuelBackdrop } from './Backdrop';
import { classFrame, lifePoints, MIN_UNLIMITED_LP, START_LP } from './gamePresentation';

vi.mock('./Backdrop.module.scss', () => ({ default: {} }));

it('los motivos repetidos del Backdrop tienen claves únicas entre hermanos', () => {
  function inspect(node: ReactNode) {
    if (Array.isArray(node)) {
      const keys = node.filter(isValidElement).map((element) => element.key).filter((key) => key !== null);
      expect(new Set(keys).size).toBe(keys.length);
      node.forEach(inspect);
    } else if (isValidElement<{ children?: ReactNode }>(node)) inspect(node.props.children);
  }
  inspect(DuelBackdrop());
});

it('las hojas de juegos compilan con los tokens y mixins del proyecto', () => {
  for (const component of ['Games', 'GameMarks', 'DuelDiskInput', 'LifePoints', 'Victory']) {
    expect(compile(path.join(import.meta.dirname, `${component}.module.scss`), {
      loadPaths: [path.resolve(import.meta.dirname, '../../../styles')],
    }).css.length).toBeGreaterThan(0);
  }
});

describe('LP de presentación', () => {
  it.each([1, 3, 4, 5, 6])('límite %i: empieza en 8000 y llega a cero solo al agotarlo', (total) => {
    expect(lifePoints(0, total)).toBe(START_LP);
    for (let failed = 1; failed < total; failed++) {
      expect(lifePoints(failed, total)).toBeGreaterThan(0);
      expect(lifePoints(failed, total)).toBeLessThan(lifePoints(failed - 1, total));
    }
    expect(lifePoints(total, total)).toBe(0);
    expect(lifePoints(total + 1, total)).toBe(0);
  });
  it('sin límite resta 800 por fallo y conserva un mínimo visible', () => {
    expect(lifePoints(0)).toBe(8000);
    expect(lifePoints(1)).toBe(7200);
    expect(lifePoints(8)).toBe(1600);
    expect(lifePoints(9)).toBe(MIN_UNLIMITED_LP);
    expect(lifePoints(1000)).toBe(MIN_UNLIMITED_LP);
    expect(lifePoints(-1)).toBe(8000);
  });
});

describe('marcos de la columna Clase', () => {
  it.each([
    ['Monstruo Normal', 'normal'], ['Monstruo de Efecto', 'effect'],
    ['Monstruo de Fusión', 'fusion'], ['Monstruo de Ritual', 'ritual'],
    ['Carta Mágica', 'spell'], ['Carta de Trampa', 'trap'], ['Monstruo Sincro', 'synchro'],
    ['Monstruo Xyz', 'xyz'], ['Monstruo Péndulo de Efecto', 'pendulum'],
    ['Monstruo de Enlace', 'link'], ['desconocido', 'normal'],
  ])('%s usa %s', (value, expected) => expect(classFrame(value)).toBe(expected));
});

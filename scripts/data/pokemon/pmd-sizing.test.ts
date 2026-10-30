import { expect, it } from 'vitest';
import { calibrateSizes } from './pmd-sizing.ts';
import { PMD_FORM_HEIGHTS } from './pmd-roster.ts';

it('calibra la mediana del suelo y mezcla las escalas geometricamente', () => {
  const sample = { id: 'ground', zone: 'ground' as const, height: 1, area: 100, heightScale: 8 };
  const result = calibrateSizes([sample, { ...sample, id: 'sky', zone: 'sky' }]);
  expect(result.k).toBe(80);
  expect(result.factors.ground).toBe(1);
  expect(result.factors.sky).toBe(Math.round(Math.sqrt(0.83) * 1000) / 1000);
  expect(calibrateSizes([{ ...sample, height: 2.5, elongated: true }]).k).toBe(80);
  expect(() => calibrateSizes([{ ...sample, area: 0 }])).toThrow();
});

it('declara las cuatro alturas de formas sin entidad propia', () => {
  expect(PMD_FORM_HEIGHTS).toEqual({ exeggutor: 10.9, 'articuno-galar': 1.7, 'zapdos-galar': 1.6, 'moltres-galar': 2 });
});

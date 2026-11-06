import { expect, it } from 'vitest';
import { plainDisplayText } from './display-text';

it('quita solo macrones en nombres y textos sin cambiar acentos ni URLs de fuentes', () => {
  expect(plainDisplayText({ name: { es: 'Kaguya Ōtsutsuki' }, attrs: ['Jinchūriki', 'Raiton: dragón'], url: 'https://example.org/Ōtsutsuki' }))
    .toEqual({ name: { es: 'Kaguya Otsutsuki' }, attrs: ['Jinchuriki', 'Raiton: dragón'], url: 'https://example.org/Ōtsutsuki' });
});

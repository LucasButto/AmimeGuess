import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HpMeter } from './Extras';

describe('PS según el presupuesto de intentos', () => {
  it.each([1, 7, 8, 10])('llega a cero al perder con %s intentos', (total) => {
    const html = renderToStaticMarkup(createElement(HpMeter, { failed: total, won: false, total }));
    expect(html).toContain('scaleX(0)');
  });
  it('conserva PS al acertar el último intento', () => {
    const html = renderToStaticMarkup(createElement(HpMeter, { failed: 7, won: true, total: 8 }));
    expect(html).toContain('scaleX(0.125)');
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, VERSUS_ENGINES, type Modality, type VersusEngine } from '@/versus/config';
import { ModeOptions, hasModeOptions } from './ModeOptions';

const render = (engine: VersusEngine, modality: Modality, options = DEFAULT_OPTIONS) =>
  renderToStaticMarkup(createElement(ModeOptions, { engine, modality, options, onChange: () => undefined, idPrefix: 'test' }));

describe('hasModeOptions', () => {
  it('solo Mayor o Menor y Estadísticas tienen opciones propias, y en todas las modalidades', () => {
    for (const modality of ['fewestAttempts', 'timeAttack', 'race'] as const) {
      for (const engine of VERSUS_ENGINES) expect(hasModeOptions(engine, modality), `${engine} ${modality}`).toBe(engine === 'higher-lower' || engine === 'stat-builder');
    }
  });
});

describe('ModeOptions', () => {
  it('Mayor o Menor: la meta de aciertos en Contrarreloj y Carrera; los fallos perdonados en Menos intentos', () => {
    for (const modality of ['timeAttack', 'race'] as const) {
      const html = render('higher-lower', modality);
      expect(html).toContain('Meta de aciertos');
      expect(html).not.toContain('Fallos perdonados');
    }
    const fewest = render('higher-lower', 'fewestAttempts');
    expect(fewest).toContain('Fallos perdonados');
    expect(fewest).not.toContain('Meta de aciertos');
  });

  it('Estadísticas: el puntaje objetivo en Contrarreloj y Carrera; las oportunidades y cómo se cuentan, con un ⓘ por opción, en Menos intentos', () => {
    for (const modality of ['timeAttack', 'race'] as const) {
      const html = render('stat-builder', modality);
      expect(html).toContain('Puntaje objetivo');
      expect(html).not.toContain('Oportunidades');
    }
    const fewest = render('stat-builder', 'fewestAttempts');
    expect(fewest).toContain('Oportunidades');
    expect(fewest).not.toContain('Puntaje objetivo');
    for (const label of ['La mejor', 'La suma', 'El promedio']) {
      expect(fewest).toContain(label);
      expect(fewest).toContain(`Ayuda: ${label}`);
    }
  });

  it('con una sola oportunidad no hay nada que elegir entre la mejor, la suma y el promedio', () => {
    const one = render('stat-builder', 'fewestAttempts', { ...DEFAULT_OPTIONS, statsAttempts: 1 });
    expect(one).toContain('Oportunidades');
    expect(one).not.toContain('La suma');
    expect(render('stat-builder', 'fewestAttempts', { ...DEFAULT_OPTIONS, statsAttempts: 2 })).toContain('La suma');
  });

  it('un motor sin opciones no dibuja nada', () => {
    expect(render('classic', 'fewestAttempts')).toBe('');
  });
});

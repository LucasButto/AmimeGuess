import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, parseConfig, type Partida } from '@/versus/config';
import { wireConfig } from './api';

const clasico: Partida = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'] };

describe('wireConfig', () => {
  const parsed = (statsAttempts: number) => {
    const result = parseConfig({ modality: 'fewestAttempts', partidas: [clasico], options: { ...DEFAULT_OPTIONS, statsAttempts } });
    if (!result.ok) throw new Error(result.errors.join(';'));
    return result.config;
  };

  it('con las 3 oportunidades de siempre no manda la opción, para que un servidor sin actualizar siga aceptando la sala', () => {
    const wire = wireConfig(parsed(3));
    expect('statsAttempts' in wire.options).toBe(false);
    // El servidor la completa con el 3.
    const received = parseConfig(wire);
    expect(received.ok && received.config.options.statsAttempts).toBe(3);
  });

  it('con otra cantidad la manda tal cual', () => {
    for (const attempts of [1, 5, 10]) expect(wireConfig(parsed(attempts)).options.statsAttempts).toBe(attempts);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, VERSUS_ENGINES } from './config';
import { engineRulesFor } from './session';

describe('engineRulesFor', () => {
  it('Contrarreloj y Carrera: ilimitado, con meta en Mayor o Menor y objetivo en Estadísticas', () => {
    for (const modality of ['timeAttack', 'race'] as const) {
      expect(engineRulesFor(modality, 'classic', DEFAULT_OPTIONS)).toEqual({ unlimited: true });
      expect(engineRulesFor(modality, 'higher-lower', DEFAULT_OPTIONS)).toEqual({ unlimited: true, targetScore: 10 });
      expect(engineRulesFor(modality, 'stat-builder', { ...DEFAULT_OPTIONS, statsTarget: 650 })).toEqual({ unlimited: true, targetTotal: 650 });
    }
  });

  it('Menos intentos: los de siempre, con fallos perdonados y 3 combinaciones', () => {
    for (const engine of VERSUS_ENGINES.filter((id) => id !== 'higher-lower' && id !== 'stat-builder' && id !== 'quiz')) {
      expect(engineRulesFor('fewestAttempts', engine, DEFAULT_OPTIONS)).toEqual({});
    }
    expect(engineRulesFor('fewestAttempts', 'higher-lower', { ...DEFAULT_OPTIONS, higherLowerForgiven: 0 })).toEqual({ forgivenErrors: 0 });
    expect(engineRulesFor('fewestAttempts', 'stat-builder', DEFAULT_OPTIONS)).toEqual({ fixedAttempts: 3 });
    // Las oportunidades de Estadísticas las elige el creador de la sala.
    for (const attempts of [1, 2, 5, 10]) expect(engineRulesFor('fewestAttempts', 'stat-builder', { ...DEFAULT_OPTIONS, statsAttempts: attempts })).toEqual({ fixedAttempts: attempts });
  });

  it('Quiz: en las tres modalidades una opción incorrecta no termina la partida (sin límite de intentos), también en Menos intentos', () => {
    for (const modality of ['fewestAttempts', 'timeAttack', 'race'] as const) {
      expect(engineRulesFor(modality, 'quiz', DEFAULT_OPTIONS), modality).toEqual({ unlimited: true });
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { EngineId } from '../franchises/types';
import {
  DEFAULT_OPTIONS,
  VERSUS_ENGINES,
  defaultTimeLimit,
  expandRepeat,
  groupRepeats,
  isValidName,
  parseConfig,
  retimePartida,
  type Partida,
  type VersusEngine,
} from './config';

// Los motores del versus son los mismos que los del sitio (si se agrega uno, este test deja de compilar).
const sameEngines: [EngineId] extends [VersusEngine] ? ([VersusEngine] extends [EngineId] ? true : false) : false = true;

const clasico: Partida = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'], timeLimitMs: 90_000 };
const untimed: Partida = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'] };

describe('parseConfig', () => {
  it('acepta una sala mínima y completa las opciones por defecto', () => {
    const result = parseConfig({ modality: 'timeAttack', partidas: [clasico] });
    expect(sameEngines).toBe(true);
    expect(VERSUS_ENGINES).toHaveLength(9);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.options).toEqual(DEFAULT_OPTIONS);
  });

  it('pide de 1 a 10 partidas', () => {
    expect(parseConfig({ modality: 'timeAttack', partidas: [] }).ok).toBe(false);
    expect(parseConfig({ modality: 'timeAttack', partidas: expandRepeat(clasico, 10) }).ok).toBe(true);
    expect(parseConfig({ modality: 'timeAttack', partidas: expandRepeat(clasico, 11) }).ok).toBe(false);
  });

  it('exige tiempo límite solo en Contrarreloj', () => {
    expect(parseConfig({ modality: 'timeAttack', partidas: [untimed] }).ok).toBe(false);
    expect(parseConfig({ modality: 'race', partidas: [untimed] }).ok).toBe(true);
    expect(parseConfig({ modality: 'fewestAttempts', partidas: [clasico] }).ok).toBe(false);
  });

  it('limita el tiempo de 10 s a 30 min, de a 5 s', () => {
    const at = (timeLimitMs: number) => parseConfig({ modality: 'timeAttack', partidas: [{ ...clasico, timeLimitMs }] }).ok;
    expect(at(10_000)).toBe(true);
    expect(at(1_800_000)).toBe(true);
    expect(at(5_000)).toBe(false);
    expect(at(1_805_000)).toBe(false);
    expect(at(62_500)).toBe(false);
  });

  it('valida las opciones de Mayor o Menor y Estadísticas', () => {
    const at = (options: object) => parseConfig({ modality: 'race', partidas: [untimed], options }).ok;
    expect(at({ higherLowerTarget: 1 })).toBe(true);
    expect(at({ higherLowerTarget: 100 })).toBe(true);
    expect(at({ higherLowerTarget: 0 })).toBe(false);
    expect(at({ higherLowerTarget: 101 })).toBe(false);
    expect(at({ higherLowerForgiven: 0 })).toBe(true);
    expect(at({ higherLowerForgiven: 6 })).toBe(false);
    expect(at({ statsTarget: 100 })).toBe(true);
    expect(at({ statsTarget: 1_500 })).toBe(true);
    expect(at({ statsTarget: 505 })).toBe(false);
    expect(at({ statsTarget: 1_510 })).toBe(false);
    expect(at({ statsAggregation: 'average' })).toBe(true);
    expect(at({ statsAggregation: 'median' })).toBe(false);
  });

  it('rechaza campos de más, series repetidas y motores que no existen', () => {
    expect(parseConfig({ modality: 'timeAttack', partidas: [{ ...clasico, extra: 1 }] }).ok).toBe(false);
    expect(parseConfig({ modality: 'timeAttack', partidas: [{ ...clasico, series: ['g1', 'g1'] }] }).ok).toBe(false);
    expect(parseConfig({ modality: 'timeAttack', partidas: [{ ...clasico, engine: 'scream' }] }).ok).toBe(false);
    expect(parseConfig({ modality: 'solo', partidas: [clasico] }).ok).toBe(false);
  });

  it('devuelve los errores con su camino', () => {
    const result = parseConfig({ modality: 'timeAttack', partidas: [{ ...clasico, timeLimitMs: 1 }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.startsWith('partidas.0.timeLimitMs'))).toBe(true);
  });
});

describe('defaultTimeLimit', () => {
  it('da el tiempo de cada tipo de modo (01-reglas.md, sección 1)', () => {
    const expected: Record<VersusEngine, number> = {
      'image-reveal': 60_000,
      'text-clue': 60_000,
      'reveal-list': 60_000,
      classic: 90_000,
      timeline: 120_000,
      'higher-lower': 120_000,
      connections: 180_000,
      'stat-builder': 180_000,
      'category-board': 180_000,
    };
    for (const engine of VERSUS_ENGINES) expect(defaultTimeLimit(engine, 1, 0)).toBe(expected[engine]);
  });

  it('suma el extra por cada serie de más: Clásico con 9 generaciones de Pokémon da 2:10', () => {
    expect(defaultTimeLimit('classic', 9, 5)).toBe(130_000);
    expect(defaultTimeLimit('classic', 1, 5)).toBe(90_000);
    expect(defaultTimeLimit('classic', 5, 0)).toBe(90_000);
  });

  it('recalcula al cambiar los filtros salvo que el tiempo se haya editado a mano', () => {
    const nine = { ...clasico, series: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'] };
    expect(retimePartida(nine, 5).timeLimitMs).toBe(130_000);
    expect(retimePartida({ ...nine, timeLimitMs: 45_000, timeEdited: true }, 5).timeLimitMs).toBe(45_000);
  });
});

describe('repeticiones', () => {
  it('expande ×3 y vuelve a agruparlo', () => {
    const silueta: Partida = { ...clasico, mode: 'silueta', engine: 'image-reveal', timeLimitMs: 60_000 };
    const list = [...expandRepeat(clasico, 3), silueta, ...expandRepeat(clasico, 2)];
    expect(list).toHaveLength(6);
    expect(groupRepeats(list).map((group) => [group.partida.mode, group.count, group.start])).toEqual([
      ['clasico', 3, 0],
      ['silueta', 1, 3],
      ['clasico', 2, 4],
    ]);
  });

  it('no agrupa partidas con filtros, interruptores o tiempos distintos', () => {
    const list = [clasico, { ...clasico, series: ['g2'] }, { ...clasico, toggles: { filler: false } }, { ...clasico, timeLimitMs: 95_000 }];
    expect(groupRepeats(list)).toHaveLength(4);
    expect(groupRepeats([{ ...clasico, toggles: {} }, { ...clasico, toggles: { filler: false } }])).toHaveLength(2);
  });
});

describe('isValidName', () => {
  it('acepta de 1 a 16 caracteres sin saltos de línea', () => {
    expect(isValidName('Ana')).toBe(true);
    expect(isValidName('Ñandú 🐦')).toBe(true);
    expect(isValidName('a'.repeat(16))).toBe(true);
    expect(isValidName('a'.repeat(17))).toBe(false);
    expect(isValidName('')).toBe(false);
    expect(isValidName('   ')).toBe(false);
    expect(isValidName('Ana\nBeto')).toBe(false);
  });
});

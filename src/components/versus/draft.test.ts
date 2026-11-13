import { describe, expect, it } from 'vitest';
import { groupRepeats } from '@/versus/config';
import {
  EMPTY_DRAFT,
  addBlock,
  buildConfig,
  clampNumber,
  clampTime,
  maxTimeMs,
  moveBlock,
  newBlock,
  parseClock,
  removeBlock,
  remainingPartidas,
  resetBlockTime,
  setBlockCount,
  setBlockTime,
  stepBlockTime,
  totalPartidas,
  visibleOptions,
  type Block,
  type Draft,
} from './draft';

const make = (id: string, extra: Partial<Parameters<typeof newBlock>[0]> = {}): Block =>
  newBlock({ id, franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'], secondsPerExtraSeries: 5, count: 1, ...extra });

describe('bloques nuevos', () => {
  it('traen el tiempo sugerido de su motor más el extra por series', () => {
    expect(make('a').partida.timeLimitMs).toBe(90_000);
    expect(make('a').extraSeconds).toBe(0);
    const nine = make('b', { series: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'] });
    expect(nine.partida.timeLimitMs).toBe(130_000);
    expect(nine.partida.defaultTimeLimitMs).toBe(130_000);
    expect(nine.extraSeconds).toBe(40);
    // Dragon Ball no suma nada por serie.
    expect(make('c', { franchise: 'dragon-ball', series: ['db', 'dbz', 'gt'], secondsPerExtraSeries: 0 }).extraSeconds).toBe(0);
  });

  it('un modo de imagen tiene 1:00, Línea de tiempo 2:00 y Estadísticas 3:00', () => {
    expect(make('a', { engine: 'image-reveal', mode: 'silueta' }).partida.timeLimitMs).toBe(60_000);
    expect(make('b', { engine: 'timeline' }).partida.timeLimitMs).toBe(120_000);
    expect(make('c', { engine: 'stat-builder' }).partida.timeLimitMs).toBe(180_000);
  });
});

describe('lista de partidas', () => {
  it('cuenta con las repeticiones y no deja pasar de 10', () => {
    let blocks: Block[] = [];
    blocks = addBlock(blocks, make('a', { count: 3 }));
    blocks = addBlock(blocks, make('b', { count: 6 }));
    expect(totalPartidas(blocks)).toBe(9);
    expect(remainingPartidas(blocks)).toBe(1);
    // Si no entra entero, se recorta el ×N a lo que queda.
    blocks = addBlock(blocks, make('c', { count: 4 }));
    expect(blocks.map((block) => block.count)).toEqual([3, 6, 1]);
    // Con 10, no entra nada más.
    expect(addBlock(blocks, make('d'))).toHaveLength(3);
  });

  it('el ×N de un bloque va de 1 al máximo que deja el resto', () => {
    const blocks = [make('a', { count: 4 }), make('b', { count: 3 })];
    expect(setBlockCount(blocks, 'a', 20).find((block) => block.id === 'a')!.count).toBe(7);
    expect(setBlockCount(blocks, 'a', 0).find((block) => block.id === 'a')!.count).toBe(1);
    expect(setBlockCount(blocks, 'b', 6).find((block) => block.id === 'b')!.count).toBe(6);
    expect(setBlockCount(blocks, 'b', 7).find((block) => block.id === 'b')!.count).toBe(6);
  });

  it('se puede quitar y mover arriba y abajo', () => {
    const blocks = [make('a'), make('b'), make('c')];
    expect(moveBlock(blocks, 'b', -1).map((block) => block.id)).toEqual(['b', 'a', 'c']);
    expect(moveBlock(blocks, 'b', 1).map((block) => block.id)).toEqual(['a', 'c', 'b']);
    expect(moveBlock(blocks, 'a', -1).map((block) => block.id)).toEqual(['a', 'b', 'c']);
    expect(moveBlock(blocks, 'c', 1).map((block) => block.id)).toEqual(['a', 'b', 'c']);
    expect(removeBlock(blocks, 'b').map((block) => block.id)).toEqual(['a', 'c']);
  });
});

describe('tiempo límite', () => {
  it('va de 0:10 a 30:00, de a 5 s', () => {
    expect(clampTime(1_000)).toBe(10_000);
    expect(clampTime(9_999_999)).toBe(1_800_000);
    expect(clampTime(62_400)).toBe(60_000);
    expect(clampTime(62_600)).toBe(65_000);
  });

  it('+ y − suman o restan 5 s y marcan el tiempo como editado; no pasan de los límites', () => {
    let blocks = [make('a')];
    blocks = stepBlockTime(blocks, 'a', 1);
    expect(blocks[0].partida).toMatchObject({ timeLimitMs: 95_000, timeEdited: true, defaultTimeLimitMs: 90_000 });
    for (let i = 0; i < 40; i++) blocks = stepBlockTime(blocks, 'a', -1);
    expect(blocks[0].partida.timeLimitMs).toBe(10_000);
  });

  it('"Volver al tiempo sugerido" lo deja como al principio', () => {
    let blocks = [make('a', { series: ['g1', 'g2'] })];
    blocks = setBlockTime(blocks, 'a', 45_000);
    expect(blocks[0].partida.timeEdited).toBe(true);
    blocks = resetBlockTime(blocks, 'a');
    expect(blocks[0].partida.timeLimitMs).toBe(95_000);
    expect(blocks[0].partida.timeEdited).toBeUndefined();
  });

  it('el tiempo máximo suma cada partida por su ×N', () => {
    expect(maxTimeMs([make('a', { count: 3 }), make('b', { engine: 'image-reveal', mode: 'silueta' })])).toBe(3 * 90_000 + 60_000);
  });

  it('entiende lo que se escribe', () => {
    expect(parseClock('1:30')).toBe(90_000);
    expect(parseClock('90')).toBe(90_000);
    expect(parseClock(' 0:45 ')).toBe(45_000);
    expect(parseClock('30:00')).toBe(1_800_000);
    expect(parseClock('1:75')).toBeNull();
    expect(parseClock('abc')).toBeNull();
    expect(parseClock('')).toBeNull();
    expect(parseClock('1:')).toBeNull();
  });
});

describe('opciones', () => {
  const hl = make('h', { engine: 'higher-lower', mode: 'mayor-o-menor' });
  const stats = make('s', { engine: 'stat-builder', mode: 'estadisticas' });
  const none = (modality: Draft['modality'], blocks: Block[]) => Object.values(visibleOptions(modality, blocks)).every((value) => !value);

  it('sin Mayor o Menor ni Estadísticas no hay opciones', () => {
    for (const modality of ['timeAttack', 'race', 'fewestAttempts'] as const) expect(none(modality, [make('a')])).toBe(true);
  });

  it('Mayor o Menor: meta en Contrarreloj y Carrera; fallos perdonados en Menos intentos', () => {
    expect(visibleOptions('timeAttack', [hl])).toMatchObject({ higherLowerTarget: true, higherLowerForgiven: false });
    expect(visibleOptions('race', [hl])).toMatchObject({ higherLowerTarget: true, higherLowerForgiven: false });
    expect(visibleOptions('fewestAttempts', [hl])).toMatchObject({ higherLowerTarget: false, higherLowerForgiven: true });
  });

  it('Estadísticas: objetivo en Contrarreloj y Carrera; cómo cuentan las 3 oportunidades en Menos intentos', () => {
    expect(visibleOptions('timeAttack', [stats])).toMatchObject({ statsTarget: true, statsAggregation: false });
    expect(visibleOptions('fewestAttempts', [stats])).toMatchObject({ statsTarget: false, statsAggregation: true });
  });

  it('los números se acotan', () => {
    expect(clampNumber(150, 1, 100)).toBe(100);
    expect(clampNumber(-3, 0, 5)).toBe(0);
    expect(clampNumber(503, 100, 1500, 10)).toBe(500);
    expect(clampNumber(Number.NaN, 1, 100)).toBe(1);
  });
});

describe('armar la sala', () => {
  const draft = (patch: Partial<Draft>): Draft => ({ ...EMPTY_DRAFT, name: 'Ana', ...patch });

  it('expande los ×N y la lista vuelve a agruparse igual', () => {
    const blocks = [make('a', { count: 3 }), make('b', { engine: 'image-reveal', mode: 'silueta', franchise: 'naruto', series: ['naruto'], count: 2 })];
    const result = buildConfig(draft({ blocks }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.partidas).toHaveLength(5);
    expect(groupRepeats(result.config.partidas).map((group) => [group.partida.mode, group.count])).toEqual([['clasico', 3], ['silueta', 2]]);
  });

  it('en Contrarreloj cada partida lleva su tiempo (y el sugerido, para el desempate)', () => {
    const blocks = setBlockTime([make('a', { count: 2 })], 'a', 45_000);
    const result = buildConfig(draft({ blocks }));
    if (!result.ok) throw new Error(result.errors.join(';'));
    expect(result.config.partidas.every((partida) => partida.timeLimitMs === 45_000 && partida.timeEdited === true && partida.defaultTimeLimitMs === 90_000)).toBe(true);
  });

  it('fuera de Contrarreloj no viaja el tiempo límite (se conserva en el borrador)', () => {
    const blocks = setBlockTime([make('a')], 'a', 45_000);
    for (const modality of ['race', 'fewestAttempts'] as const) {
      const result = buildConfig(draft({ blocks, modality }));
      if (!result.ok) throw new Error(result.errors.join(';'));
      expect(result.config.partidas[0].timeLimitMs).toBeUndefined();
      expect(result.config.partidas[0].timeEdited).toBeUndefined();
    }
    // Al volver a Contrarreloj, el tiempo editado sigue.
    expect(blocks[0].partida.timeLimitMs).toBe(45_000);
  });

  it('solo viajan las opciones que valen; el resto, con su valor por defecto', () => {
    const stats = make('s', { engine: 'stat-builder', mode: 'estadisticas' });
    const result = buildConfig(draft({ blocks: [stats], modality: 'race', options: { higherLowerTarget: 50, higherLowerForgiven: 5, statsTarget: 700, statsAggregation: 'sum' } }));
    if (!result.ok) throw new Error(result.errors.join(';'));
    expect(result.config.options).toEqual({ higherLowerTarget: 10, higherLowerForgiven: 3, statsTarget: 700, statsAggregation: 'best' });
  });

  it('sin partidas la configuración no es válida', () => {
    expect(buildConfig(draft({})).ok).toBe(false);
  });

  it('las variantes y los interruptores pasan a la partida', () => {
    const block = newBlock({ id: 'x', franchise: 'dragon-ball', mode: 'poder', engine: 'higher-lower', variant: 'm-ki', series: ['db'], toggles: { filler: false }, secondsPerExtraSeries: 0, count: 1 });
    const result = buildConfig(draft({ blocks: [block] }));
    if (!result.ok) throw new Error(result.errors.join(';'));
    expect(result.config.partidas[0]).toMatchObject({ variant: 'm-ki', toggles: { filler: false } });
  });
});

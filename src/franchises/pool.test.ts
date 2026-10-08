import { describe, expect, it } from 'vitest';
import type { Content, Entity } from '@/engine/types';
import type { FranchiseData } from './data';
import { minimumPoolOf, modePoolSize } from './pool';
import type { ModeConfig } from './types';

const entity = (id: string, series: string[], attrs: Entity['attrs'] = {}): Entity => ({ id, name: { es: id }, aliases: [], series, image: `x/${id}`, attrs });

const characters = [entity('a', ['s1'], { peso: 5 }), entity('b', ['s1', 's2'], { peso: 9 }), entity('c', ['s2'], { peso: 1 })];
const forms = [entity('f1', ['s1']), entity('f2', ['s2']), entity('f3', ['s2'])];
const events: Content[] = [1, 2, 3].map((order) => ({ id: `e${order}`, kind: 'event', series: order === 3 ? 's2' : 's1', payload: { text: `t${order}`, order }, verified: true }));
const data: FranchiseData = { entities: characters, contents: events, entitySets: { forms } };

const base = { slug: 'm', name: 'M' } as const;
const classic: ModeConfig = { ...base, engine: 'classic', classic: { columns: [], hints: [] } };

describe('modePoolSize', () => {
  it('Clásico: las entidades elegibles con las series activas', () => {
    expect(modePoolSize(classic, data, ['s1', 's2'])).toBe(3);
    expect(modePoolSize(classic, data, ['s1'])).toBe(2);
    expect(modePoolSize(classic, data, ['s2'])).toBe(2);
  });

  it('un modo con conjunto de entidades cuenta las de ese conjunto', () => {
    const mode: ModeConfig = { ...base, engine: 'image-reveal', entitySet: 'forms', imageReveal: { variant: 'blur' } };
    expect(modePoolSize(mode, data, ['s1', 's2'])).toBe(3);
    expect(modePoolSize(mode, data, ['s1'])).toBe(1);
  });

  it('un conjunto que no existe no tiene pool', () => {
    const mode: ModeConfig = { ...base, engine: 'image-reveal', entitySet: 'inexistente', imageReveal: { variant: 'blur' } };
    expect(modePoolSize(mode, data, ['s1', 's2'])).toBe(0);
  });

  it('Mayor o Menor: las entidades con valor numérico', () => {
    const mode: ModeConfig = { ...base, engine: 'higher-lower', higherLower: { metrics: [{ key: 'peso', label: 'Peso', question: '?' }] } };
    expect(modePoolSize(mode, data, ['s1', 's2'])).toBe(3);
    expect(modePoolSize({ ...mode, higherLower: { metrics: [{ key: 'otro', label: 'Otro', question: '?' }] } }, data, ['s1'])).toBe(0);
  });

  it('Línea de tiempo: los sucesos elegibles', () => {
    const mode: ModeConfig = { ...base, engine: 'timeline', timeline: { contentKind: 'event', textField: 'text', orderField: 'order' } };
    expect(modePoolSize(mode, data, ['s1', 's2'])).toBe(3);
    expect(modePoolSize(mode, data, ['s2'])).toBe(1);
  });

  it('un modo sin la configuración de su motor, o con un motor que no existe, no tiene pool', () => {
    expect(modePoolSize({ ...base, engine: 'classic' }, data, ['s1'])).toBeNull();
    expect(modePoolSize({ ...base, engine: 'timeline' }, data, ['s1'])).toBeNull();
    expect(modePoolSize({ ...base, engine: 'connections' }, data, ['s1'])).toBeNull();
  });
});

describe('minimumPoolOf', () => {
  it('es el mínimo de su motor: 20 para el Clásico y 10 para el resto', () => {
    expect(minimumPoolOf(classic)).toBe(20);
    expect(minimumPoolOf({ ...base, engine: 'timeline' })).toBe(10);
    expect(minimumPoolOf({ ...base, engine: 'higher-lower' })).toBe(10);
  });
});

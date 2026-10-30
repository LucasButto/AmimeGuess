import { describe, expect, it } from 'vitest';
import { clearPracticeStates } from '@/components/game-shell/practice';
import type { StorageLike } from '@/engine/storage';
import { readRecord, recordKey, saveRecord } from './record';

const key = recordKey('test', 'compare', ['g1', 'g2'], 'weight');

describe('récord histórico infinito', () => {
  it('conserva el máximo entre partidas y sobrevive a la limpieza de práctica', () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      get length() { return entries.size; },
      key: (index: number) => [...entries.keys()][index] ?? null,
      removeItem: (key: string) => { entries.delete(key); },
    };
    expect(readRecord(storage, key)).toBe(0);
    expect(saveRecord(storage, key, 35)).toBe(35);
    expect(saveRecord(storage, key, 8)).toBe(35);
    clearPracticeStates(storage);
    expect(readRecord(storage, key)).toBe(35);
    expect(saveRecord(storage, key, 48)).toBe(48);
  });

  it('separa franquicia, modo, filtros y medida; el orden de filtros no importa', () => {
    expect(recordKey('test', 'compare', ['g2', 'g1'], 'weight')).toBe(key);
    for (const other of [
      recordKey('other', 'compare', ['g1', 'g2'], 'weight'),
      recordKey('test', 'other', ['g1', 'g2'], 'weight'),
      recordKey('test', 'compare', ['g1'], 'weight'),
      recordKey('test', 'compare', ['g1', 'g2'], 'height'),
    ]) expect(other).not.toBe(key);
  });

  it('tolera datos dañados, almacenamiento bloqueado o ausente', () => {
    for (const value of ['NaN', '-1', '1.5', 'Infinity', '{}']) {
      expect(readRecord({ getItem: () => value, setItem: () => {} }, key)).toBe(0);
    }
    const blocked: StorageLike = { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } };
    expect(readRecord(blocked, key)).toBe(0);
    expect(saveRecord(blocked, key, 12)).toBe(12);
    expect(saveRecord(null, key, 12)).toBe(12);
  });
});

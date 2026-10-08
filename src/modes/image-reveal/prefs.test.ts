import { describe, expect, it } from 'vitest';
import type { StorageLike } from '@/engine/storage';
import { DEFAULT_PREFS, prefsKey, readPrefs, writePrefs } from './prefs';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('prefsKey', () => {
  it('sigue el formato de las demás claves, por franquicia y modo', () => {
    expect(prefsKey('pokemon', 'silueta')).toBe('md:v1:prefs:pokemon:silueta');
  });
});

describe('readPrefs', () => {
  it('sin nada guardado, lo más fácil: revelar y colores prendidos', () => {
    expect(readPrefs(memoryStorage(), 'pokemon', 'silueta')).toEqual({ reveal: true, colors: true });
    expect(DEFAULT_PREFS).toEqual({ reveal: true, colors: true });
  });

  it('recuerda lo que se guardó', () => {
    const storage = memoryStorage();
    writePrefs(storage, 'pokemon', 'silueta', { reveal: false, colors: true });
    expect(readPrefs(storage, 'pokemon', 'silueta')).toEqual({ reveal: false, colors: true });
  });

  it('cada modo tiene los suyos', () => {
    const storage = memoryStorage();
    writePrefs(storage, 'pokemon', 'silueta', { reveal: false, colors: false });
    expect(readPrefs(storage, 'pokemon', 'zoom')).toEqual(DEFAULT_PREFS);
    expect(readPrefs(storage, 'naruto', 'silueta')).toEqual(DEFAULT_PREFS);
  });

  it('un valor dañado vuelve al de por defecto, campo por campo', () => {
    const key = prefsKey('pokemon', 'zoom');
    expect(readPrefs(memoryStorage({ [key]: 'no es json' }), 'pokemon', 'zoom')).toEqual(DEFAULT_PREFS);
    expect(readPrefs(memoryStorage({ [key]: '"texto"' }), 'pokemon', 'zoom')).toEqual(DEFAULT_PREFS);
    expect(readPrefs(memoryStorage({ [key]: 'null' }), 'pokemon', 'zoom')).toEqual(DEFAULT_PREFS);
    expect(readPrefs(memoryStorage({ [key]: '{"reveal":false,"colors":"si"}' }), 'pokemon', 'zoom')).toEqual({
      reveal: false,
      colors: true,
    });
  });

  it('sin almacenamiento, o si falla, no rompe', () => {
    expect(readPrefs(null, 'pokemon', 'zoom')).toEqual(DEFAULT_PREFS);
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('lleno');
      },
    };
    expect(readPrefs(broken, 'pokemon', 'zoom')).toEqual(DEFAULT_PREFS);
    expect(writePrefs(broken, 'pokemon', 'zoom', DEFAULT_PREFS)).toBe(false);
    expect(writePrefs(null, 'pokemon', 'zoom', DEFAULT_PREFS)).toBe(false);
  });
});

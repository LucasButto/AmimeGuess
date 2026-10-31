import { describe, expect, it } from 'vitest';
import { SHARE_MARKS, themeGrid } from '../game-shell/share';
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, readPrefs, writePrefs } from '../prefs';
import { ICONS } from './icons';
import { bitmapSvg, pixelPaths } from './bitmap';

describe('pixelPaths', () => {
  it('arma un path por color con tramos horizontales y deja transparentes el punto y el espacio', () => {
    const paths = pixelPaths({ rows: ['aa.b', ' a b'], palette: { a: 'red', b: 'blue' } });
    expect(paths).toEqual([
      { color: 'red', d: 'M0 0h2v1h-2zM1 1h1v1h-1z' },
      { color: 'blue', d: 'M3 0h1v1h-1zM3 1h1v1h-1z' },
    ]);
  });

  it('ignora los caracteres que no están en la paleta', () => {
    expect(pixelPaths({ rows: ['x#'], palette: { '#': 'currentColor' } })).toEqual([{ color: 'currentColor', d: 'M1 0h1v1h-1z' }]);
  });

  it('cada ícono tiene filas y algún píxel pintado', () => {
    for (const [name, icon] of Object.entries(ICONS)) {
      expect(icon.rows.length, name).toBeGreaterThan(0);
      expect(pixelPaths(icon).length, name).toBe(1);
    }
  });
});

describe('bitmapSvg', () => {
  it('escribe un SVG nítido con un path por color', () => {
    expect(bitmapSvg({ rows: ['a.', '.a'], palette: { a: '#123456' } })).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2" width="2" height="2" shape-rendering="crispEdges"><path fill="#123456" d="M0 0h1v1h-1zM1 1h1v1h-1z"/></svg>\n',
    );
  });
});

describe('themeGrid', () => {
  it('cambia las marcas de acierto, parcial y error por los emojis del tema', () => {
    const grid = [`${SHARE_MARKS.incorrect}${SHARE_MARKS.partial}${SHARE_MARKS.correct}`];
    expect(themeGrid(grid, { correct: '🟢', partial: '🟡', incorrect: '🔴' })).toEqual(['🔴🟡🟢']);
  });

  it('con las marcas por defecto la grilla queda igual, y lo que no es una marca no se toca', () => {
    const grid = ['🟩🟧🟥', '…', '🟦🟪'];
    expect(themeGrid(grid, SHARE_MARKS)).toEqual(grid);
  });
});

describe('preferencias', () => {
  it('sin nada guardado, o con algo roto, valen las de por defecto (todo apagado)', () => {
    expect(DEFAULT_PREFS).toEqual({ legibleFont: false, sounds: false });
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{roto')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('"texto"')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"sounds":"sí","legibleFont":1}')).toEqual(DEFAULT_PREFS);
  });

  it('se guardan en md:v1:prefs y se leen igual', () => {
    expect(PREFS_KEY).toBe('md:v1:prefs');
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
    writePrefs(storage, { legibleFont: true, sounds: false });
    expect(readPrefs(storage)).toEqual({ legibleFont: true, sounds: false });
  });

  it('un almacenamiento que falla no rompe nada', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('lleno');
      },
    };
    expect(readPrefs(broken)).toEqual(DEFAULT_PREFS);
    expect(() => writePrefs(broken, DEFAULT_PREFS)).not.toThrow();
  });
});

it('restores only supported reading sizes and preserves old preferences', () => {
  expect(parsePrefs('{"textScale":2,"sounds":true}')).toEqual({legibleFont:false,sounds:true,textScale:2});
  expect(parsePrefs('{"textScale":3}').textScale).toBe(3);
  expect(parsePrefs('{"textScale":99}')).toEqual(DEFAULT_PREFS);
});

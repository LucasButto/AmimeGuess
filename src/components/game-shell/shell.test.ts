import { describe, expect, it } from 'vitest';
import { formatCountdown, toIsoDuration } from './format';
import {
  MAX_GRID_LINES,
  buildShareText,
  buildShareUrl,
  describeFilters,
  joinWords,
  limitGrid,
} from './share';
import { bestScore, distributionRows, rowHolds, winRate } from './stats';

const POKEMON = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'];
const LABELS = Object.fromEntries(POKEMON.map((id) => [id, `Gen ${id.slice(1)}`]));

describe('buildShareUrl', () => {
  it('agrega el parámetro s con la clave de filtro', () => {
    expect(buildShareUrl('https://animeguess.vercel.app/pokemon/clasico', 'g1.g2')).toBe(
      'https://animeguess.vercel.app/pokemon/clasico?s=g1.g2',
    );
  });

  it('reemplaza un s anterior y conserva el resto de la dirección', () => {
    expect(buildShareUrl('http://localhost:3000/pokemon/clasico?s=all&x=1', 'g3')).toBe(
      'http://localhost:3000/pokemon/clasico?s=g3&x=1',
    );
  });

  it('con todas las series lleva s=all', () => {
    expect(buildShareUrl('https://a.b/pokemon/clasico', 'all')).toBe('https://a.b/pokemon/clasico?s=all');
  });

  it('descarta el ancla', () => {
    expect(buildShareUrl('https://a.b/c#seccion', 'g1')).toBe('https://a.b/c?s=g1');
  });
});

describe('describeFilters', () => {
  it('todas las series activas: "todas"', () => {
    expect(describeFilters(POKEMON, POKEMON, LABELS)).toBe('todas');
    expect(describeFilters([...POKEMON].reverse(), POKEMON, LABELS)).toBe('todas');
  });

  it('una sola serie', () => {
    expect(describeFilters(['g4'], POKEMON, LABELS)).toBe('Gen 4');
  });

  it('dos series con "y"', () => {
    expect(describeFilters(['g2', 'g1'], POKEMON, LABELS)).toBe('Gen 1 y Gen 2');
  });

  it('varias series: comas y un "y" final, en orden canónico', () => {
    expect(describeFilters(['g5', 'g1', 'g2'], POKEMON, LABELS)).toBe('Gen 1, Gen 2 y Gen 5');
  });

  it('si falta el nombre de una serie usa su id', () => {
    expect(describeFilters(['g1'], ['g1', 'g2'], {})).toBe('g1');
  });

  it('joinWords con 0, 1, 2 y 3 palabras', () => {
    expect(joinWords([])).toBe('');
    expect(joinWords(['a'])).toBe('a');
    expect(joinWords(['a', 'b'])).toBe('a y b');
    expect(joinWords(['a', 'b', 'c'])).toBe('a, b y c');
  });
});

describe('limitGrid', () => {
  const lines = (count: number) => Array.from({ length: count }, (_, i) => `línea ${i + 1}`);

  it('una grilla corta queda igual', () => {
    expect(limitGrid(lines(3))).toEqual(lines(3));
    expect(limitGrid(lines(MAX_GRID_LINES))).toEqual(lines(MAX_GRID_LINES));
  });

  it('una larga conserva las últimas líneas y marca que faltan las primeras', () => {
    const result = limitGrid(lines(MAX_GRID_LINES + 5));
    expect(result).toHaveLength(MAX_GRID_LINES + 1);
    expect(result[0]).toBe('…');
    expect(result.at(-1)).toBe(`línea ${MAX_GRID_LINES + 5}`);
    expect(result[1]).toBe('línea 6');
  });

  it('no modifica la grilla original', () => {
    const original = lines(20);
    limitGrid(original);
    expect(original).toHaveLength(20);
  });
});

describe('buildShareText', () => {
  const base = {
    franchiseName: 'Pokémon',
    modeName: 'Clásico',
    filters: 'Gen 1 y Gen 2',
    won: true,
    attempts: 4,
    grid: ['🟥🟥🟩🟥🟥🟥🟥🟥', '🟩🟧🟩🟥🟥🟥🟧🟥', '🟩🟩🟩🟩🟩🟩🟩🟩'],
    url: 'https://animeguess.vercel.app/pokemon/clasico?s=g1.g2',
  };

  it('arma el texto completo: juego, modo, series, intentos, grilla y link', () => {
    expect(buildShareText(base)).toBe(
      [
        'AnimeGuess · Pokémon · Clásico',
        'Series: Gen 1 y Gen 2',
        'Lo resolví en 4 intentos',
        '',
        '🟥🟥🟩🟥🟥🟥🟥🟥',
        '🟩🟧🟩🟥🟥🟥🟧🟥',
        '🟩🟩🟩🟩🟩🟩🟩🟩',
        '',
        'https://animeguess.vercel.app/pokemon/clasico?s=g1.g2',
      ].join('\n'),
    );
  });

  it('incluye el link con el parámetro s correcto', () => {
    const text = buildShareText({ ...base, url: buildShareUrl('https://x.y/pokemon/clasico', 'g1.g2') });
    expect(text).toContain('?s=g1.g2');
  });

  it('"todas" cuando no hay filtros', () => {
    expect(buildShareText({ ...base, filters: describeFilters(POKEMON, POKEMON, LABELS) })).toContain('Series: todas');
  });

  it('singular con un solo intento', () => {
    expect(buildShareText({ ...base, attempts: 1 })).toContain('Lo resolví en 1 intento');
  });

  it('si no se ganó, lo dice', () => {
    expect(buildShareText({ ...base, won: false })).toContain('Hoy no lo resolví');
  });

  it('sin grilla no deja líneas vacías de más', () => {
    const text = buildShareText({ ...base, grid: [] });
    expect(text).not.toContain('\n\n\n');
    expect(text.endsWith(base.url)).toBe(true);
  });

  it('solo contiene lo que se le dio: no puede revelar la respuesta', () => {
    const answer = 'Cubone';
    const text = buildShareText(base);
    expect(text).not.toContain(answer);
    // Cada línea es del encabezado, de la grilla o el link.
    for (const line of text.split('\n')) {
      expect(
        line === '' ||
          line.startsWith('AnimeGuess ·') ||
          line.startsWith('Series: ') ||
          line.startsWith('Lo resolví') ||
          /^[🟩🟧🟥]+$/u.test(line) ||
          line.startsWith('https://'),
      ).toBe(true);
    }
  });

  it('recorta una grilla muy larga', () => {
    const grid = Array.from({ length: 40 }, () => '🟥🟥🟥');
    const text = buildShareText({ ...base, grid });
    expect(text.split('\n').filter((line) => line.startsWith('🟥'))).toHaveLength(MAX_GRID_LINES);
    expect(text).toContain('…');
  });
});

describe('formatCountdown', () => {
  it('HH:MM:SS con ceros a la izquierda', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(1000)).toBe('00:00:01');
    expect(formatCountdown(61_000)).toBe('00:01:01');
    expect(formatCountdown(5 * 3600_000 + 12 * 60_000 + 33_000)).toBe('05:12:33');
    expect(formatCountdown(24 * 3600_000)).toBe('24:00:00');
  });

  it('redondea hacia arriba: nunca muestra 00:00:00 antes de tiempo', () => {
    expect(formatCountdown(1)).toBe('00:00:01');
    expect(formatCountdown(999)).toBe('00:00:01');
    expect(formatCountdown(1001)).toBe('00:00:02');
  });

  it('nunca es negativo', () => {
    expect(formatCountdown(-5000)).toBe('00:00:00');
  });

  it('la duración ISO 8601', () => {
    expect(toIsoDuration(5 * 3600_000 + 12 * 60_000 + 33_000)).toBe('PT5H12M33S');
    expect(toIsoDuration(0)).toBe('PT0H0M0S');
  });
});

describe('distributionRows', () => {
  it('sin victorias, ninguna fila', () => {
    expect(distributionRows({})).toEqual([]);
    expect(distributionRows({ '3': 0 })).toEqual([]);
  });

  it('filas de 1 hasta el mayor valor, con 0 donde no hubo', () => {
    const rows = distributionRows({ '2': 1, '5': 3 });
    expect(rows.map((row) => row.label)).toEqual(['1', '2', '3', '4', '5']);
    expect(rows.map((row) => row.count)).toEqual([0, 1, 0, 0, 3]);
  });

  it('agrupa lo que pasa del tope en una fila final "13+"', () => {
    const rows = distributionRows({ '4': 2, '13': 1, '20': 2, '12': 1 });
    expect(rows).toHaveLength(13);
    expect(rows[3].count).toBe(2);
    expect(rows[11].count).toBe(1);
    expect(rows[12]).toMatchObject({ label: '13+', count: 3, attempts: null });
  });

  it('con un tope menor, la fila final agrupa desde el siguiente', () => {
    const rows = distributionRows({ '1': 1, '4': 2 }, 3);
    expect(rows.map((row) => row.label)).toEqual(['1', '2', '3', '4+']);
    expect(rows[3].count).toBe(2);
  });

  it('ignora claves inválidas', () => {
    expect(distributionRows({ x: 3, '0': 2, '-1': 1, '2.5': 1, '3': 1 }).map((row) => row.count)).toEqual([0, 0, 1]);
  });

  it('rowHolds: una fila "13+" contiene cualquier cantidad desde 13', () => {
    const rows = distributionRows({ '3': 1, '15': 1 });
    expect(rowHolds(rows[2], 3)).toBe(true);
    expect(rowHolds(rows[2], 4)).toBe(false);
    expect(rowHolds(rows[12], 13)).toBe(true);
    expect(rowHolds(rows[12], 30)).toBe(true);
    expect(rowHolds(rows[12], 12)).toBe(false);
  });
});

describe('winRate', () => {
  it('porcentaje entero', () => {
    expect(winRate({ played: 0, won: 0 })).toBe(0);
    expect(winRate({ played: 4, won: 3 })).toBe(75);
    expect(winRate({ played: 3, won: 1 })).toBe(33);
    expect(winRate({ played: 3, won: 2 })).toBe(67);
    expect(winRate({ played: 5, won: 5 })).toBe(100);
  });
});

describe('resultados con puntaje', () => {
  const scored = {
    franchiseName: 'Pokémon',
    modeName: 'Mayor o Menor',
    filters: 'todas',
    won: true,
    attempts: 8,
    score: 7,
    grid: ['🟩🟩🟩🟩🟩🟩🟩🟥'],
    url: 'https://animeguess.vercel.app/pokemon/mayor-o-menor?s=all',
  };

  it('el texto compartido dice la racha de aciertos en vez de los intentos', () => {
    expect(buildShareText(scored)).toBe(
      [
        'AnimeGuess · Pokémon · Mayor o Menor',
        'Series: todas',
        'Racha de aciertos: 7',
        '',
        '🟩🟩🟩🟩🟩🟩🟩🟥',
        '',
        'https://animeguess.vercel.app/pokemon/mayor-o-menor?s=all',
      ].join('\n'),
    );
  });

  it('con puntaje 0 también lo dice (no cae en "Hoy no lo resolví")', () => {
    const text = buildShareText({ ...scored, score: 0, attempts: 1, grid: ['🟥'] });
    expect(text).toContain('Racha de aciertos: 0');
    expect(text).not.toContain('Hoy no lo resolví');
  });

  it('sin puntaje, el texto sigue siendo el de intentos', () => {
    expect(buildShareText({ ...scored, score: undefined })).toContain('Lo resolví en 8 intentos');
  });

  it('el texto no trae nada de la partida más que colores y el puntaje', () => {
    expect(buildShareText(scored)).not.toMatch(/kg|altura|peso/i);
  });

  it('la distribución de un modo de puntaje empieza en 0', () => {
    const rows = distributionRows({ '0': 2, '3': 1 }, 12, 0);
    expect(rows.map((row) => [row.label, row.count])).toEqual([
      ['0', 2],
      ['1', 0],
      ['2', 0],
      ['3', 1],
    ]);
  });

  it('un modo de intentos sigue ignorando el 0', () => {
    expect(distributionRows({ '0': 2, '2': 1 }).map((row) => row.label)).toEqual(['1', '2']);
  });

  it('con puntaje agrupa desde el tope: 12 filas y una final "12+"', () => {
    const rows = distributionRows({ '0': 1, '11': 1, '12': 2, '25': 1 }, 12, 0);
    expect(rows).toHaveLength(13);
    expect(rows[11]).toMatchObject({ label: '11', count: 1 });
    expect(rows[12]).toMatchObject({ label: '12+', attempts: null, count: 3 });
    expect(rowHolds(rows[12], 30)).toBe(true);
    expect(rowHolds(rows[12], 11)).toBe(false);
  });

  it('el mejor puntaje es la mayor clave con partidas', () => {
    expect(bestScore({ '0': 3, '4': 1, '9': 2 })).toBe(9);
    expect(bestScore({ '0': 3 })).toBe(0);
    expect(bestScore({})).toBe(0);
    expect(bestScore({ '7': 0, '2': 1 })).toBe(2);
  });
});

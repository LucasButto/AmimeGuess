// Tests del reto diario (SPEC sección 5).
//
// Los vectores fijos de este archivo NO se modifican para que pasen: un cambio
// de código que altere estos resultados cambia el reto de todas las personas
// y es un bug. Se calcularon con una implementación independiente (FNV y
// fmix32 con BigInt, y la selección reescrita aparte) y coinciden con la del
// motor.

import { describe, expect, it } from 'vitest';
import {
  MAX_EXCLUSION_DAYS,
  exclusionWindow,
  pickDaily,
  pickRaw,
  seedFor,
  yesterday,
  type DailyContext,
} from './daily';
import { fnv1a32 } from './hash';
import { mulberry32, randomInt } from './rng';

/**
 * item-01 … item-NN: ids del mismo largo que solo difieren al final. Sirven
 * para los vectores fijos y para comprobar que el reparto no depende de que
 * los ids sean variados (el peor caso de FNV-1a sin mezclador).
 */
const ids = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `item-${String(i + 1).padStart(count > 99 ? 3 : 2, '0')}` }));

/** Ids de largo y contenido variable, parecidos a nombres reales (`karito`, `muzegen`…). */
function names(count: number): Array<{ id: string }> {
  const rng = mulberry32(7);
  const syllables = ['ka', 'ri', 'to', 'mu', 'ne', 'shi', 'ro', 'ba', 'do', 'lu', 'ze', 'po', 'fu', 'gen', 'ta', 'mi'];
  const unique = new Set<string>();
  while (unique.size < count) {
    let word = '';
    for (let i = 0, parts = randomInt(rng, 2, 5); i < parts; i++) {
      word += syllables[randomInt(rng, 0, syllables.length)];
    }
    unique.add(word);
  }
  return [...unique].map((id) => ({ id }));
}

const POOL_30 = ids(30);
const NAMES_30 = names(30);
const NAMES_200 = names(200);

describe('vectores fijos', () => {
  // Pool: item-01 … item-30 (K = 10). `raw` es el ganador sin exclusiones; en
  // dos vectores (g1.g2 día 365 y yugioh día -1) difiere de la respuesta porque
  // el ganador crudo estaba excluido.
  const vectors: Array<[string, string, string, number, string, string]> = [
    // franchise, mode, filterKey, day, answer, raw
    ['pokemon', 'clasico', 'all', 0, 'item-14', 'item-14'],
    ['pokemon', 'clasico', 'all', 1, 'item-28', 'item-28'],
    ['pokemon', 'clasico', 'all', 2, 'item-12', 'item-12'],
    ['pokemon', 'clasico', 'all', 100, 'item-07', 'item-07'],
    ['pokemon', 'clasico', 'g1', 0, 'item-05', 'item-05'],
    ['pokemon', 'clasico', 'g1.g2', 3, 'item-28', 'item-28'],
    ['pokemon', 'clasico', 'g1.g2', 365, 'item-12', 'item-26'],
    ['pokemon', 'silueta', 'all', 0, 'item-18', 'item-18'],
    ['pokemon', 'silueta', 'g2.g5', 1000, 'item-04', 'item-04'],
    ['naruto', 'clasico', 'all', 0, 'item-13', 'item-13'],
    ['naruto', 'frase', 'naruto.shippuden', 7, 'item-02', 'item-02'],
    ['dragon-ball', 'poder', 'dbz.super', 500, 'item-03', 'item-03'],
    ['yugioh', 'duelista', 'gx', -1, 'item-22', 'item-05'],
  ];

  it.each(vectors)('%s · %s · %s · día %i → %s', (franchise, mode, filterKey, day, answer, raw) => {
    const ctx = { franchise, mode, filterKey, day };
    expect(pickDaily(POOL_30, ctx).id).toBe(answer);
    expect(pickRaw(POOL_30, ctx).id).toBe(raw);
  });

  it('semillas de los modos de secuencia', () => {
    expect(seedFor({ franchise: 'pokemon', mode: 'clasico', filterKey: 'all', day: 0 })).toBe(0xad44004d);
    expect(seedFor({ franchise: 'pokemon', mode: 'clasico', filterKey: 'all', day: 0 })).toBe(
      fnv1a32('pokemon|clasico|all|0'),
    );
    expect(seedFor({ franchise: 'naruto', mode: 'conexiones', filterKey: 'naruto.shippuden', day: 12 })).toBe(
      fnv1a32('naruto|conexiones|naruto.shippuden|12'),
    );
  });
});

describe('determinismo', () => {
  const ctx: DailyContext = { franchise: 'pokemon', mode: 'clasico', filterKey: 'g1.g2', day: 321 };

  it('la misma entrada da la misma salida en 1000 llamadas', () => {
    const first = pickDaily(POOL_30, ctx).id;
    for (let i = 0; i < 1000; i++) {
      expect(pickDaily(POOL_30, ctx).id).toBe(first);
    }
  });

  it('el orden del pool no influye', () => {
    const reversed = [...NAMES_30].reverse();
    const rotated = [...NAMES_30.slice(11), ...NAMES_30.slice(0, 11)];
    for (let day = 0; day < 40; day++) {
      const c = { ...ctx, day };
      const expected = pickDaily(NAMES_30, c).id;
      expect(pickDaily(reversed, c).id).toBe(expected);
      expect(pickDaily(rotated, c).id).toBe(expected);
    }
  });

  it('un filterKey distinto cambia la respuesta en la mayoría de 100 días', () => {
    let different = 0;
    for (let day = 0; day < 100; day++) {
      const a = pickDaily(NAMES_200, { ...ctx, filterKey: 'g1', day }).id;
      const b = pickDaily(NAMES_200, { ...ctx, filterKey: 'g1.g2', day }).id;
      if (a !== b) different++;
    }
    expect(different).toBeGreaterThan(90);
  });

  it('otro modo u otra franquicia también cambian la respuesta', () => {
    let differentMode = 0;
    let differentFranchise = 0;
    for (let day = 0; day < 100; day++) {
      const base = pickDaily(NAMES_200, { ...ctx, day }).id;
      if (pickDaily(NAMES_200, { ...ctx, mode: 'silueta', day }).id !== base) differentMode++;
      if (pickDaily(NAMES_200, { ...ctx, franchise: 'naruto', day }).id !== base) differentFranchise++;
    }
    expect(differentMode).toBeGreaterThan(90);
    expect(differentFranchise).toBeGreaterThan(90);
  });

  it('todos los elementos del pool llegan a ser respuesta con el tiempo', () => {
    const seen = new Set<string>();
    for (let day = 0; day < 600; day++) seen.add(pickDaily(NAMES_30, { ...ctx, day }).id);
    expect(seen.size).toBe(NAMES_30.length);
  });
});

describe('estabilidad al cambiar el dataset', () => {
  it('agregar un elemento a un pool de 200 cambia la respuesta en menos del 5 % de 1000 días', () => {
    const grown = [...NAMES_200, { id: 'nuevo-elemento' }];
    let changed = 0;
    for (let day = 0; day < 1000; day++) {
      const ctx = { franchise: 'pokemon', mode: 'clasico', filterKey: 'all', day };
      if (pickDaily(NAMES_200, ctx).id !== pickDaily(grown, ctx).id) changed++;
    }
    expect(changed).toBeLessThan(50);
  }, 30_000);

  it('quitar un elemento solo cambia los días en que era la respuesta o su ganador previo', () => {
    const removed = NAMES_200[100];
    const shrunk = NAMES_200.filter((item) => item !== removed);
    let changed = 0;
    for (let day = 0; day < 1000; day++) {
      const ctx = { franchise: 'pokemon', mode: 'clasico', filterKey: 'all', day };
      if (pickDaily(NAMES_200, ctx).id !== pickDaily(shrunk, ctx).id) changed++;
    }
    expect(changed).toBeLessThan(50);
  }, 30_000);
});

describe('ventana de exclusión', () => {
  it('K = min(14, floor(n / 3))', () => {
    expect(MAX_EXCLUSION_DAYS).toBe(14);
    expect(exclusionWindow(0)).toBe(0);
    expect(exclusionWindow(2)).toBe(0);
    expect(exclusionWindow(3)).toBe(1);
    expect(exclusionWindow(30)).toBe(10);
    expect(exclusionWindow(41)).toBe(13);
    expect(exclusionWindow(42)).toBe(14);
    expect(exclusionWindow(1025)).toBe(14);
  });

  // La SPEC excluye el ganador "crudo" de los K días anteriores, no la
  // respuesta que se mostró. Así la respuesta de un día depende solo del pool
  // y no de una cadena de días previos, y agregar o quitar un elemento no
  // desordena todo lo demás.
  const base = { franchise: 'pokemon', mode: 'clasico', filterKey: 'all' };
  const K = exclusionWindow(NAMES_200.length);
  const DAYS = 1000;

  const raws = new Map<number, string>();
  for (let day = -K; day < DAYS; day++) raws.set(day, pickRaw(NAMES_200, { ...base, day }).id);
  const answers: string[] = [];
  for (let day = 0; day < DAYS; day++) answers.push(pickDaily(NAMES_200, { ...base, day }).id);

  it('la respuesta nunca es el ganador crudo de ninguno de los K días anteriores', () => {
    expect(K).toBe(14);
    let violations = 0;
    for (let day = 0; day < DAYS; day++) {
      for (let back = 1; back <= K; back++) {
        if (answers[day] === raws.get(day - back)) violations++;
      }
    }
    expect(violations).toBe(0);
  }, 30_000);

  it('la mayoría de los días la respuesta es el ganador crudo; solo se reemplaza si estaba excluido', () => {
    const same = answers.filter((answer, day) => answer === raws.get(day)).length;
    expect(same).toBeGreaterThan(DAYS * 0.85);
  }, 30_000);

  // Limitación conocida de la regla de la SPEC: si un día el ganador crudo
  // estaba excluido y se mostró otro elemento, ese reemplazo no está protegido
  // y puede volver a salir dentro de la ventana. Con 200 elementos ocurre en
  // ~0,5 % de los días; con pools chicos (30) sube a ~11 %.
  it('una respuesta repetida dentro de la ventana es excepcional (< 3 % de los días)', () => {
    let daysWithRepeat = 0;
    for (let day = K; day < DAYS; day++) {
      for (let back = 1; back <= K; back++) {
        if (answers[day] === answers[day - back]) {
          daysWithRepeat++;
          break;
        }
      }
    }
    expect(daysWithRepeat / (DAYS - K)).toBeLessThan(0.03);
  }, 30_000);

});

describe('desempate y pools chicos', () => {
  const ctx: DailyContext = { franchise: 'pokemon', mode: 'clasico', filterKey: 'all', day: 0 };

  it('si dos elementos empatan en score, gana el de menor id', () => {
    // Colisión real de FNV-1a de 32 bits para este contexto.
    expect(fnv1a32('pokemon|clasico|all|0|k-bb')).toBe(fnv1a32('pokemon|clasico|all|0|k-ny90'));
    const a = { id: 'k-bb' };
    const b = { id: 'k-ny90' };
    expect(pickRaw([a, b], ctx).id).toBe('k-bb');
    expect(pickRaw([b, a], ctx).id).toBe('k-bb');
    expect(pickDaily([a, b], ctx).id).toBe('k-bb');
    expect(pickDaily([b, a], ctx).id).toBe('k-bb');
  });

  it('el desempate compara unidades de código, no el idioma del dispositivo', () => {
    // Otra colisión real. Por unidades de código 'R' (82) va antes que 'n' (110);
    // con localeCompare iría después ('n' < 'R'), y el reto dependería del idioma
    // del dispositivo.
    expect(fnv1a32('pokemon|clasico|all|0|k-RS')).toBe(fnv1a32('pokemon|clasico|all|0|k-nyIa'));
    expect(['k-nyIa', 'k-RS'].sort((a, b) => a.localeCompare(b))[0]).toBe('k-nyIa');
    const upper = { id: 'k-RS' };
    const lower = { id: 'k-nyIa' };
    expect(pickRaw([lower, upper], ctx).id).toBe('k-RS');
    expect(pickRaw([upper, lower], ctx).id).toBe('k-RS');
  });

  it('un pool de un elemento devuelve ese elemento todos los días', () => {
    const only = [{ id: 'unico' }];
    for (let day = -5; day < 30; day++) {
      expect(pickDaily(only, { ...ctx, day }).id).toBe('unico');
    }
  });

  it('con 1 o 2 elementos no se excluye nada (K = 0) y siempre hay respuesta', () => {
    const two = [{ id: 'a' }, { id: 'b' }];
    for (let day = 0; day < 50; day++) {
      const c = { ...ctx, day };
      expect(pickDaily(two, c).id).toBe(pickRaw(two, c).id);
    }
  });

  it('con un pool vacío falla con un error claro', () => {
    expect(() => pickDaily([], ctx)).toThrow(RangeError);
    expect(() => pickRaw([], ctx)).toThrow(RangeError);
  });

  it('con el pool más chico que excluye algo (n = 3, K = 1) siempre queda un candidato', () => {
    const three = ids(3);
    for (let day = 0; day < 200; day++) {
      const answer = pickDaily(three, { ...ctx, day });
      expect(three).toContainEqual(answer);
    }
  });
});

describe('yesterday', () => {
  const ctx: DailyContext = { franchise: 'dragon-ball', mode: 'clasico', filterKey: 'dbz.super', day: 50 };

  it('es la respuesta del día anterior con la misma combinación de filtros', () => {
    expect(yesterday(POOL_30, ctx)).toBe(pickDaily(POOL_30, { ...ctx, day: 49 }));
  });

  // Hoy nunca es el ganador crudo de ayer (está dentro de la ventana). Puede
  // coincidir con la respuesta de ayer solo si ayer se mostró un reemplazo;
  // es la misma limitación conocida de la ventana de exclusión.
  it('el reto de hoy nunca es el ganador crudo de ayer', () => {
    for (let day = 1; day < 200; day++) {
      const c = { ...ctx, day };
      expect(pickDaily(NAMES_30, c).id).not.toBe(pickRaw(NAMES_30, { ...c, day: day - 1 }).id);
    }
  });

  it('cambia al cambiar de filtros', () => {
    let different = 0;
    for (let day = 1; day < 100; day++) {
      const a = yesterday(NAMES_200, { ...ctx, filterKey: 'dbz', day }).id;
      const b = yesterday(NAMES_200, { ...ctx, filterKey: 'dbz.super', day }).id;
      if (a !== b) different++;
    }
    expect(different).toBeGreaterThan(90);
  });
});

describe('calidad del reparto', () => {
  // Sin el mezclador final, FNV-1a repartía muy mal los ids del mismo largo que
  // solo difieren al final: con item-001…item-200 un elemento ganaba el 14 %
  // de los días (el azar daría el 0,5 %) y el chi² era ~90 veces el ideal.
  const DAYS = 2000;
  const base = { franchise: 'pokemon', mode: 'clasico', filterKey: 'all' };

  function winsPerItem(pool: Array<{ id: string }>, filterKey = 'all'): number[] {
    const wins = new Map<string, number>(pool.map((item) => [item.id, 0]));
    for (let day = 0; day < DAYS; day++) {
      const winner = pickRaw(pool, { ...base, filterKey, day }).id;
      wins.set(winner, (wins.get(winner) ?? 0) + 1);
    }
    return [...wins.values()];
  }

  const chiSquare = (wins: number[]) => {
    const expected = DAYS / wins.length;
    return wins.reduce((sum, w) => sum + (w - expected) ** 2 / expected, 0);
  };

  it.each([
    ['ids numerados item-001…item-200', ids(200)],
    ['ids numerados item-01…item-10', ids(10)],
    ['nombres de largo variable (200)', NAMES_200],
  ])('cada elemento gana una parte pareja de los días: %s', (_label, pool) => {
    const wins = winsPerItem(pool);
    const expected = DAYS / pool.length;
    // Grados de libertad = n − 1. 1,5× deja mucho margen sobre el azar y queda
    // lejísimos del reparto roto (chi² de ~90× en el caso de 200 ids).
    expect(chiSquare(wins)).toBeLessThan((pool.length - 1) * 1.5);
    expect(Math.max(...wins)).toBeLessThan(expected * 2.5);
    expect(Math.min(...wins)).toBeGreaterThan(0);
  }, 30_000);

  it('dos combinaciones de filtros casi no coinciden más de lo que da el azar', () => {
    const pool = ids(30);
    let same = 0;
    for (let day = 0; day < 300; day++) {
      const a = pickRaw(pool, { ...base, filterKey: 'all', day }).id;
      const b = pickRaw(pool, { ...base, filterKey: 'g1.g2', day }).id;
      if (a === b) same++;
    }
    // Azar: 300 / 30 = 10. Sin el mezclador coincidían 86 de 300.
    expect(same).toBeLessThan(25);
  });
});

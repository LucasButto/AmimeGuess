import { describe, expect, it } from 'vitest';
import { fmix32, fnv1a32 } from './hash';

describe('fnv1a32', () => {
  it('coincide con los vectores publicados de FNV-1a de 32 bits', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('vectores fijos de las claves que usa el reto diario', () => {
    expect(fnv1a32('pokemon|clasico|all|0')).toBe(0xad44004d);
  });

  it('usa los bytes UTF-8 del texto, no las unidades UTF-16', () => {
    expect(fnv1a32('ñandú')).toBe(0xb48f3ccb);
    expect(fnv1a32('ポケモン')).toBe(0x1054cb51);
  });

  it('siempre devuelve un entero sin signo de 32 bits', () => {
    for (const text of ['', 'a', 'item-01', 'ñandú', 'x'.repeat(500)]) {
      const hash = fnv1a32(text);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('es determinista', () => {
    expect(fnv1a32('pikachu')).toBe(fnv1a32('pikachu'));
    expect(fnv1a32('pikachu')).not.toBe(fnv1a32('raichu'));
  });
});

describe('fmix32', () => {
  it('coincide con el finalizador de MurmurHash3', () => {
    expect(fmix32(0)).toBe(0);
    // Valor de referencia publicado para la entrada 1.
    expect(fmix32(1)).toBe(0x514e28b7);
  });

  it('vectores fijos', () => {
    expect(fmix32(2)).toBe(0x30f4c306);
    expect(fmix32(0x811c9dc5)).toBe(0xab3e7c0b);
    expect(fmix32(0xffffffff)).toBe(0x81f16f39);
    expect(fmix32(0xdeadbeef)).toBe(0x0de5c6a9);
  });

  it('devuelve siempre un entero sin signo de 32 bits', () => {
    for (const value of [0, 1, 0x7fffffff, 0x80000000, 0xffffffff, 123456789]) {
      const mixed = fmix32(value);
      expect(Number.isInteger(mixed)).toBe(true);
      expect(mixed).toBeGreaterThanOrEqual(0);
      expect(mixed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('es una biyección: entradas distintas dan salidas distintas', () => {
    const seen = new Set<number>();
    for (let value = 0; value < 50_000; value++) seen.add(fmix32(value));
    expect(seen.size).toBe(50_000);
  });

  it('cambiar un solo bit de la entrada cambia la mitad de los bits de la salida, en promedio', () => {
    let changedBits = 0;
    let samples = 0;
    for (let value = 0; value < 2000; value++) {
      for (let bit = 0; bit < 32; bit++) {
        let diff = fmix32(value) ^ fmix32((value ^ (1 << bit)) >>> 0);
        while (diff) {
          changedBits += diff & 1;
          diff >>>= 1;
        }
        samples++;
      }
    }
    expect(changedBits / samples).toBeGreaterThan(15);
    expect(changedBits / samples).toBeLessThan(17);
  });
});

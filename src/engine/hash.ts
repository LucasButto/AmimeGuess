const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const encoder = new TextEncoder();

/**
 * FNV-1a de 32 bits sobre los bytes UTF-8 del texto. Devuelve un entero sin
 * signo (0 … 2^32 − 1). Es la base de la selección del reto diario, así que su
 * resultado no puede cambiar nunca: los vectores de prueba lo protegen.
 */
export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of encoder.encode(input)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Finalizador de MurmurHash3 (fmix32): mezcla todos los bits de un entero de
 * 32 bits. FNV-1a mezcla poco los últimos bytes, así que el score del reto
 * diario pasa por acá. Es una biyección: no crea ni elimina empates, solo
 * reparte los valores. Devuelve un entero sin signo.
 */
export function fmix32(value: number): number {
  let h = value;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isRoomCode, newRoomCode, type RandomValues } from './code';

/** Una fuente de azar fija: devuelve los valores dados, en orden y en ronda. */
function fixed(values: readonly number[]): RandomValues {
  let next = 0;
  return (buffer) => {
    for (let index = 0; index < buffer.length; index++) buffer[index] = values[next++ % values.length];
    return buffer;
  };
}

describe('códigos de sala', () => {
  it('no usa caracteres que se confunden', () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(31);
    for (const confusing of ['0', '1', 'O', 'I', 'L']) expect(ROOM_CODE_ALPHABET).not.toContain(confusing);
  });

  it('arma 6 caracteres del alfabeto con la fuente dada', () => {
    expect(newRoomCode(fixed([0, 1, 2, 3, 4, 30]))).toBe('23456Z');
    expect(newRoomCode(fixed([31, 62]))).toBe('222222');
  });

  it('descarta los valores que sesgarían el reparto', () => {
    expect(newRoomCode(fixed([0xffffffff, 5]))).toBe('777777');
  });

  it('con azar real da códigos válidos y distintos', () => {
    const random: RandomValues = (buffer) => globalThis.crypto.getRandomValues(buffer);
    const codes = new Set(Array.from({ length: 200 }, () => newRoomCode(random)));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(isRoomCode(code)).toBe(true);
    }
  });

  it('reconoce solo códigos bien formados', () => {
    expect(isRoomCode('K7P2QX')).toBe(true);
    expect(isRoomCode('k7p2qx')).toBe(false);
    expect(isRoomCode('K7P2Q')).toBe(false);
    expect(isRoomCode('K7P2QXA')).toBe(false);
    expect(isRoomCode('K7P2Q0')).toBe(false);
    expect(isRoomCode('K7P2QL')).toBe(false);
  });
});

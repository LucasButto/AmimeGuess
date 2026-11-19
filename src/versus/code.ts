// Códigos de sala (docs/versus/02-arquitectura.md): 6 caracteres sin los que se confunden (0/O, 1/I/L). Son 31^6, unos
// 887 millones de combinaciones: imposibles de adivinar en la práctica para salas que duran horas.

export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 6;

/** Llena el arreglo con enteros al azar (en el sitio y en el servidor, `crypto.getRandomValues`). */
export type RandomValues = (buffer: Uint32Array) => Uint32Array;

const SIZE = ROOM_CODE_ALPHABET.length;
/** El mayor múltiplo de 31 que entra en 32 bits: lo de más se descarta para que cada letra salga con la misma probabilidad. */
const UNBIASED_LIMIT = Math.floor(2 ** 32 / SIZE) * SIZE;

/** Un código nuevo con la fuente de azar dada. */
export function newRoomCode(randomValues: RandomValues): string {
  let code = '';
  const buffer = new Uint32Array(ROOM_CODE_LENGTH * 2);
  while (code.length < ROOM_CODE_LENGTH) {
    randomValues(buffer);
    for (const value of buffer) {
      if (value >= UNBIASED_LIMIT) continue;
      code += ROOM_CODE_ALPHABET[value % SIZE];
      if (code.length === ROOM_CODE_LENGTH) break;
    }
  }
  return code;
}

const CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Si el texto es un código de sala bien formado (en mayúsculas, como se genera). */
export function isRoomCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

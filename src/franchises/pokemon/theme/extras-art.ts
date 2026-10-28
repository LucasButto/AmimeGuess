// Pixel art propio de medallas y métricas; catálogo de las insignias de tipo aportadas.

import type { PaletteArt } from './art';

// Insignias aportadas por el usuario; sin dibujos de tipo duplicados.
export const TYPE_NAMES = ["Normal","Fuego","Agua","Planta","Eléctrico","Hielo","Lucha","Veneno","Tierra","Volador","Psíquico","Bicho","Roca","Fantasma","Dragón","Siniestro","Acero","Hada"] as const;
export type TypeName = (typeof TYPE_NAMES)[number];

export function isTypeName(value: string): value is TypeName {
  return (TYPE_NAMES as readonly string[]).includes(value);
}

/** Nombre de archivo estable, sin tildes; una sola fuente para el mapeo. */
export function typeBadgeFile(type: TypeName): string {
  return type.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() + '.png';
}

// --- Medallas de racha (8 × 8) ---------------------------------------------------
// K contorno, W brillo; el resto es el color propio de cada medalla. Apagadas, todo en gris.

const MEDAL_ROWS: ReadonlyArray<{ readonly rows: readonly string[]; readonly colors: Readonly<Record<string, string>> }> = [
  // Gota
  { rows: ['...KK...', '..KBBK..', '.KBBBBK.', '.KBWBBK.', 'KBWBBBBK', 'KBBBBBBK', '.KBBBBK.', '..KKKK..'], colors: { B: 'blue' } },
  // Hoja
  { rows: ['....KKK.', '..KKGGK.', '.KGGGGK.', 'KGGWGGK.', 'KGWGGK..', 'KWGGK...', 'KKKK....', 'K.......'], colors: { G: 'grass-1' } },
  // Llama
  { rows: ['...K....', '..KRK...', '..KRRK..', '.KRYRK..', '.KRYYRK.', 'KRYYYRK.', 'KRRYRRK.', '.KKKKK..'], colors: { R: 'red', Y: 'yellow' } },
  // Rayo
  { rows: ['....KKK.', '...KYYK.', '..KYYK..', '.KYYYKK.', 'KKKYYYK.', '..KYYK..', '.KYK....', '.KK.....'], colors: { Y: 'yellow' } },
  // Roca
  { rows: ['..KKKK..', '.KGGGGK.', 'KGWGGGGK', 'KGGGGSGK', 'KGGGSSGK', 'KGGGGGGK', '.KGGGGK.', '..KKKK..'], colors: { G: 'gray', S: 'ink-shadow' } },
  // Estrella
  { rows: ['...KK...', '..KYYK..', 'KKKYYKKK', 'KYYYYYYK', '.KYYYYK.', '.KYKKYK.', 'KYK..KYK', 'KK....KK'], colors: { Y: 'yellow' } },
  // Luna
  { rows: ['..KKK...', '.KVVK...', 'KVVK....', 'KVK.....', 'KVK.....', 'KVVK....', '.KVVK...', '..KKK...'], colors: { V: 'violet' } },
  // Corazón
  { rows: ['.KK..KK.', 'KPPKKPPK', 'KPWPPPPK', 'KPPPPPPK', '.KPPPPK.', '..KPPK..', '...KK...', '........'], colors: { P: 'pink' } },
];

/** Una medalla encendida (con sus colores) o apagada (gris). */
export function medal(index: number, lit: boolean): PaletteArt {
  const { rows, colors } = MEDAL_ROWS[index % MEDAL_ROWS.length];
  if (lit) return { rows, colors: { K: 'frame', W: 'white', ...colors } };
  const off = Object.fromEntries(Object.keys(colors).map((char) => [char, 'cloud-shade']));
  return { rows, colors: { K: 'gray', W: 'cloud-shade', ...off } };
}

export const MEDAL_COUNT = MEDAL_ROWS.length;

// --- Íconos de las métricas de Mayor o Menor (14 × 14) ---------------------------
// K trazo, y el color propio de cada uno. Van al lado de la pregunta ("¿Cuál pesa más?"), para que se note qué se compara.

/** Lo que se compara en Mayor o Menor y tiene ícono propio: el peso, la altura, las estadísticas base y el número de la Pokédex. */
export const METRIC_ICON_KEYS = ['peso', 'altura', 'totalEstadisticas', 'numero'] as const;
export type MetricIconKey = (typeof METRIC_ICON_KEYS)[number];

export const METRIC_ICONS: Readonly<Record<MetricIconKey, PaletteArt>> = {
  // Una pesa: el aro de arriba y el cuerpo gris con un brillo.
  peso: {
    colors: { K: 'frame', G: 'gray', W: 'white' },
    rows: [
      '....KKKKKK....',
      '...KK....KK...',
      '...K......K...',
      '...K......K...',
      '..KKKKKKKKKK..',
      '.KGGGGGGGGGGK.',
      '.KGWGGGGGGGGK.',
      'KGGWGGGGGGGGGK',
      'KGGGGGGGGGGGGK',
      'KGGGGGGGGGGGGK',
      'KGGGGGGGGGGGGK',
      'KGGGGGGGGGGGGK',
      '.KGGGGGGGGGGK.',
      '..KKKKKKKKKK..',
    ],
  },
  // Una flecha doble entre dos topes: la altura.
  altura: {
    colors: { K: 'frame', B: 'blue' },
    rows: [
      '.KKKKKKKKKKKK.',
      '......KK......',
      '.....KBBK.....',
      '....KBBBBK....',
      '...KBBBBBBK...',
      '...KKKBBKKK...',
      '.....KBBK.....',
      '.....KBBK.....',
      '...KKKBBKKK...',
      '...KBBBBBBK...',
      '....KBBBBK....',
      '.....KBBK.....',
      '......KK......',
      '.KKKKKKKKKKKK.',
    ],
  },
  // Una chapa con un "#": el número de la Pokédex.
  numero: {
    colors: { K: 'frame', W: 'white', B: 'blue' },
    rows: [
      '..KKKKKKKKKK..',
      '.KWWWWWWWWWWK.',
      'KWWWBWWWBWWWWK',
      'KWWWBWWWBWWWWK',
      'KWBBBBBBBBBBWK',
      'KWWWBWWWBWWWWK',
      'KWWWBWWWBWWWWK',
      'KWBBBBBBBBBBWK',
      'KWWWBWWWBWWWWK',
      'KWWWBWWWBWWWWK',
      'KWWWBWWWBWWWWK',
      'KWWWWWWWWWWWWK',
      '.KWWWWWWWWWWK.',
      '..KKKKKKKKKK..',
    ],
  },
  // Tres barras de distinta altura: las estadísticas base (el total y cada una).
  totalEstadisticas: {
    colors: { K: 'frame', R: 'red', Y: 'yellow', G: 'grass-1' },
    rows: [
      '..............',
      '..........KKKK',
      '..........KGGK',
      '..........KGGK',
      '..........KGGK',
      '.....KKKK.KGGK',
      '.....KYYK.KGGK',
      '.....KYYK.KGGK',
      'KKKK.KYYK.KGGK',
      'KRRK.KYYK.KGGK',
      'KRRK.KYYK.KGGK',
      'KRRK.KYYK.KGGK',
      'KRRK.KYYK.KGGK',
      'KKKKKKKKKKKKKK',
    ],
  },
};

/** Las estadísticas base que se comparan una por una (PS, Ataque…): usan las barras del total. */
const STAT_KEYS = ['ps', 'ataque', 'defensa', 'ataqueEspecial', 'defensaEspecial', 'velocidad'] as const;

/** El ícono de lo que se compara, o `null` si no tiene. */
export function metricIconKey(value: string): MetricIconKey | null {
  if ((STAT_KEYS as readonly string[]).includes(value)) return 'totalEstadisticas';
  return (METRIC_ICON_KEYS as readonly string[]).includes(value) ? (value as MetricIconKey) : null;
}

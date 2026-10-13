// Pixel art de la piel de Pokémon (sesión 15), dibujado acá cuadrícula por cuadrícula: es la única fuente
// de los dibujos. Los componentes lo pintan como SVG en la página (`PixelArt`) y `npm run design:assets`
// escribe en public/theme/pokemon/ los que se usan como fondo. Todo original: nada trazado ni copiado.
// Sin alias de rutas, para que el script lo pueda importar.

import type { Bitmap } from '../../../components/ui/bitmap';

/** Un dibujo con sus colores como nombres de la paleta del tema (config.ts → variables --palette-*). */
export interface PaletteArt {
  readonly rows: readonly string[];
  /** Carácter → nombre de color de la paleta. */
  readonly colors: Readonly<Record<string, string>>;
}

/** Para pintarlo en la página: cada color es su variable CSS, así sigue al tema. */
export function inlineArt(art: PaletteArt): Bitmap {
  return { rows: art.rows, palette: Object.fromEntries(Object.entries(art.colors).map(([char, name]) => [char, `var(--palette-${name})`])) };
}

/** Para un archivo estático: cada color resuelto a su valor de la paleta. */
export function fileArt(art: PaletteArt, palette: Readonly<Record<string, string>>): Bitmap {
  return {
    rows: art.rows,
    palette: Object.fromEntries(
      Object.entries(art.colors).map(([char, name]) => {
        const value = palette[name];
        if (value === undefined) throw new Error(`Color "${name}" fuera de la paleta`);
        return [char, value];
      }),
    ),
  };
}

/** Un lienzo transparente de `width` × `height` con dibujos pegados en sus posiciones (sin recortar). */
function compose(width: number, height: number, parts: ReadonlyArray<{ rows: readonly string[]; x: number; y: number }>): string[] {
  const canvas = Array.from({ length: height }, () => Array<string>(width).fill('.'));
  for (const { rows, x, y } of parts) {
    rows.forEach((row, dy) => {
      [...row].forEach((char, dx) => {
        if (char !== '.' && canvas[y + dy]?.[x + dx] !== undefined) canvas[y + dy][x + dx] = char;
      });
    });
  }
  return canvas.map((row) => row.join(''));
}

// --- Nubes -------------------------------------------------------------------
// W blanco, S sombra celeste (la base de la nube).

const CLOUD_COLORS = { W: 'white', S: 'cloud-shade' };

const SMALL_CLOUD = [
  '.....WWWW.......',
  '...WWWWWWWW.WW..',
  '.WWWWWWWWWWWWWW.',
  'WWWWWWWWWWWWWWWW',
  'SWWWWWWWWWWWWWWS',
  '.SSSSSSSSSSSSSS.',
];

const BIG_CLOUD = [
  '..........WWWWWW............',
  '.......WWWWWWWWWWW...WWW....',
  '.....WWWWWWWWWWWWWWWWWWWWW..',
  '...WWWWWWWWWWWWWWWWWWWWWWWW.',
  '.WWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'SWWWWWWWWWWWWWWWWWWWWWWWWWWS',
  '.SSWWWWWWWWWWWWWWWWWWWWWWSS.',
  '...SSSSSSSSSSSSSSSSSSSSSS...',
];

/** Nubes chicas del fondo: un mosaico que se repite a lo ancho. */
export const CLOUDS_BACK: PaletteArt = {
  colors: CLOUD_COLORS,
  rows: compose(80, 12, [
    { rows: SMALL_CLOUD, x: 6, y: 1 },
    { rows: SMALL_CLOUD, x: 50, y: 6 },
  ]),
};

/** Nubes grandes de adelante. */
export const CLOUDS_FRONT: PaletteArt = {
  colors: CLOUD_COLORS,
  rows: compose(120, 16, [
    { rows: BIG_CLOUD, x: 10, y: 1 },
    { rows: SMALL_CLOUD, x: 78, y: 9 },
  ]),
};

// Al atardecer la base de las nubes se tiñe de naranja, como el cielo: los mismos dibujos con otra sombra.
const DUSK_CLOUD_COLORS = { W: 'white', S: 'dawn' };

export const CLOUDS_BACK_DUSK: PaletteArt = { ...CLOUDS_BACK, colors: DUSK_CLOUD_COLORS };

export const CLOUDS_FRONT_DUSK: PaletteArt = { ...CLOUDS_FRONT, colors: DUSK_CLOUD_COLORS };

// --- Pasto alto ----------------------------------------------------------------
// D contorno (pasto oscuro), g pasto claro.

export const GRASS_TUFTS: PaletteArt = {
  colors: { D: 'grass-3', g: 'grass-1', G: 'grass-2' },
  rows: [
    '...D..........D.........D.......',
    '..DgD..D.....DgD..D....DgD......',
    '..DgD.DgD....DgD.DgD...DgD.D....',
    '.DgGDDgGD...DgGDDgGD..DgGDDgD...',
    'DgGGGgGGGD.DgGGGgGGD.DgGGGgGGD..',
  ],
};

// --- Bola ----------------------------------------------------------------------
// K contorno, T tono de la mitad de arriba, W blanco (toda la mitad de abajo), H brillo, B el botón del medio.
// Partida en dos mitades para que la de arriba se pueda levantar (resuelto, hover, al recogerse).

export const BALL_TOP_ROWS = [
  '....KKKK....',
  '..KKTTTTKK..',
  '.KTTTTTTHTK.',
  '.KTTTTTTTTK.',
  'KTTTTKKTTTTK',
  'KKKKKBBKKKKK',
];

export const BALL_BOTTOM_ROWS = [
  'KWWWWKKWWWWK',
  'KWWWWWWWWWWK',
  '.KWWWWWWWWK.',
  '.KWWWWWWWWK.',
  '..KKWWWWKK..',
  '....KKKK....',
];

/** Los colores de la bola, con su tono (un color de la paleta) en la mitad de arriba. */
export function ballColors(tone: string): Readonly<Record<string, string>> {
  return { K: 'frame', T: tone, W: 'white', H: 'white', B: 'white' };
}

/** La bola roja entera, para la viñeta del título. */
export const TITLE_BALL: PaletteArt = { colors: ballColors('red'), rows: [...BALL_TOP_ROWS, ...BALL_BOTTOM_ROWS] };

// --- Bola grande de las tarjetas de modo (30 × 30) ------------------------------
// La cáscara en dos mitades sin el botón: el botón (18 × 18, con el ícono del modo de 10 × 10 encima, a 3
// píxeles de su borde) va en su propia capa, así queda en su lugar cuando la mitad de arriba se levanta.
// K contorno, T tono, H brillo, W blanco.

export const CARD_BALL_TOP = [
  '............KKKKKK............',
  '.........KKKTTTTTTKKK.........',
  '.......KKTTTTTTTTTTTTKK.......',
  '......KTTTTTTTTTTTTTTTTK......',
  '....KKTTTTTTTTTTTTTTTTTTKK....',
  '....KTTHHTTTTTTTTTTTTTTTTK....',
  '...KTTHHTTTTTTTTTTTTTTTTTTK...',
  '..KTTTHTTTTTTTTTTTTTTTTTTTTK..',
  '..KTTTTTTTTTTTTTTTTTTTTTTTTK..',
  '.KTTTTTTTTTTTTTTTTTTTTTTTTTTK.',
  '.KTTTTTTTTTTTTTTTTTTTTTTTTTTK.',
  '.KTTTTTTTTTTTTTTTTTTTTTTTTTTK.',
  'KTTTTTTTTTTTTTTTTTTTTTTTTTTTTK',
  'KTTTTTTTTTTTTTTTTTTTTTTTTTTTTK',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
];

export const CARD_BALL_BOTTOM = [
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  'KWWWWWWWWWWWWWWWWWWWWWWWWWWWWK',
  'KWWWWWWWWWWWWWWWWWWWWWWWWWWWWK',
  '.KWWWWWWWWWWWWWWWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWWWWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWWWWWWWWWWWWWWWK.',
  '..KWWWWWWWWWWWWWWWWWWWWWWWWK..',
  '..KWWWWWWWWWWWWWWWWWWWWWWWWK..',
  '...KWWWWWWWWWWWWWWWWWWWWWWK...',
  '....KWWWWWWWWWWWWWWWWWWWWK....',
  '....KKWWWWWWWWWWWWWWWWWWKK....',
  '......KWWWWWWWWWWWWWWWWK......',
  '.......KKWWWWWWWWWWWWKK.......',
  '.........KKKWWWWWWKKK.........',
  '............KKKKKK............',
];

/** El botón central de la bola sin ícono (10 × 10), el de la bola grande del selector: va centrado, a 10 píxeles del borde. */
export const PICKER_BALL_BUTTON: PaletteArt = {
  colors: { K: 'frame', B: 'white' },
  rows: [
    '...KKKK...',
    '..KBBBBK..',
    '.KBBBBBBK.',
    'KBBBBBBBBK',
    'KBBBBBBBBK',
    'KBBBBBBBBK',
    'KBBBBBBBBK',
    '.KBBBBBBK.',
    '..KBBBBK..',
    '...KKKK...',
  ],
};

/** El botón central (18 × 18): el ícono del modo (10 × 10) va encima, centrado, con 3 píxeles de aire. */
export const CARD_BALL_BUTTON: PaletteArt = {
  colors: { K: 'frame', B: 'white' },
  rows: [
    '.......KKKK.......',
    '....KKKBBBBKKK....',
    '...KBBBBBBBBBBK...',
    '..KBBBBBBBBBBBBK..',
    '.KBBBBBBBBBBBBBBK.',
    '.KBBBBBBBBBBBBBBK.',
    '.KBBBBBBBBBBBBBBK.',
    'KBBBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBBBK',
    '.KBBBBBBBBBBBBBBK.',
    '.KBBBBBBBBBBBBBBK.',
    '.KBBBBBBBBBBBBBBK.',
    '..KBBBBBBBBBBBBK..',
    '...KBBBBBBBBBBK...',
    '....KKKBBBBKKK....',
    '.......KKKK.......',
  ],
};

// --- Íconos de modo (10 × 10) ----------------------------------------------------
// I tinta (contorno), y el color propio de cada uno. Todos originales.

const icon = (rows: readonly string[], colors: Readonly<Record<string, string>> = {}): PaletteArt => ({
  rows,
  colors: { I: 'frame', ...colors },
});

export const MODE_ICONS = {
  // Silueta: un semicírculo en sombra.
  silhouette: icon([
    '..........',
    '..........',
    '...IIII...',
    '.IIIIIIII.',
    '.IIIIIIII.',
    'IIIIIIIIII',
    'IIIIIIIIII',
    'IIIIIIIIII',
    '..........',
    '..........',
  ]),
  // Descripción: una hoja con renglones.
  sheet: icon(
    [
      '.IIIIIIII.',
      '.IWWWWWWI.',
      '.IWIIIIWI.',
      '.IWWWWWWI.',
      '.IWIIIIWI.',
      '.IWWWWWWI.',
      '.IWIIIWWI.',
      '.IWWWWWWI.',
      '.IWWWWWWI.',
      '.IIIIIIII.',
    ],
    { W: 'cream' },
  ),
  // Carta: una carta con una estrella.
  card: icon(
    [
      '.IIIIIIII.',
      '.IWWWWWWI.',
      '.IWWSSWWI.',
      '.IWSSSSWI.',
      '.ISSSSSSI.',
      '.IWSSSSWI.',
      '.IWSWWSWI.',
      '.IWWWWWWI.',
      '.IWWWWWWI.',
      '.IIIIIIII.',
    ],
    { W: 'cream', S: 'yellow' },
  ),
  // Movimiento insignia: un destello de cuatro puntas y uno chico.
  sparkle: icon(
    [
      '...I......',
      '...I......',
      '..IYI.....',
      '.IYYYI....',
      'IIYYYII...',
      '.IYYYI....',
      '..IYI...I.',
      '...I...III',
      '...I....I.',
      '..........',
    ],
    { Y: 'yellow' },
  ),
  // Mayor o menor: una flecha arriba y una abajo.
  arrows: icon([
    '..I...III.',
    '.III..III.',
    'IIIII.III.',
    '.III..III.',
    '.III..III.',
    '.III..III.',
    '.III..III.',
    '.III.IIIII',
    '.III..III.',
    '.III...I..',
  ]),
  // Moveset: cuatro casillas.
  squares: icon(
    [
      'IIII..IIII',
      'IWWI..IWWI',
      'IWWI..IWWI',
      'IIII..IIII',
      '..........',
      '..........',
      'IIII..IIII',
      'IWWI..IWWI',
      'IWWI..IWWI',
      'IIII..IIII',
    ],
    { W: 'cream' },
  ),
} as const satisfies Record<string, PaletteArt>;

export type ModeIconName = keyof typeof MODE_ICONS;

// --- Pokédex ---------------------------------------------------------------------

/** Lente grande: contorno, aro blanco, aro oscuro y vidrio azul con brillo y sombra. */
export const POKEDEX_LENS: PaletteArt = {
  colors: { K: 'frame', W: 'white', L: 'blue', H: 'white', N: 'night' },
  rows: [
    '....KKKKKK....',
    '..KKWWWWWWKK..',
    '.KWWKKKKKKWWK.',
    '.KWKLLLLLLKWK.',
    'KWKLHHLLLLLKWK',
    'KWKLHLLLLLLKWK',
    'KWKLLLLLLLLKWK',
    'KWKLLLLLLLNKWK',
    'KWKLLLLLLNNKWK',
    'KWKLLLLLNNNKWK',
    '.KWKLLLNNNKWK.',
    '.KWWKKKKKKWWK.',
    '..KKWWWWWWKK..',
    '....KKKKKK....',
  ],
};

/** Luz chica: `C` es su color. */
export const POKEDEX_LIGHT_ROWS = ['..KK..', '.KHCK.', 'KCCCCK', 'KCCCCK', '.KCCK.', '..KK..'];

/** Cruceta decorativa. */
export const POKEDEX_DPAD: PaletteArt = {
  colors: { K: 'frame', D: 'ink' },
  rows: [
    '...KKKKK...',
    '...KDDDK...',
    '...KDDDK...',
    'KKKKDDDKKKK',
    'KDDDDDDDDDK',
    'KDDDDKDDDDK',
    'KDDDDDDDDDK',
    'KKKKDDDKKKK',
    '...KDDDK...',
    '...KDDDK...',
    '...KKKKK...',
  ],
};

/** Pokédex chica (12 × 12) para la navegación entre modos: carcasa roja, lente, dos luces y pantalla. */
export const MINI_POKEDEX: PaletteArt = {
  colors: { K: 'frame', R: 'red', L: 'blue', Y: 'yellow', G: 'grass-1', N: 'night' },
  rows: [
    '.KKKKKKKKKK.',
    'KRRRRRRRRRRK',
    'KRKKKRRRRRRK',
    'KRKLKRYRGRRK',
    'KRKKKRRRRRRK',
    'KRRRRRRRRRRK',
    'KRKKKKKKKKRK',
    'KRKNNNNNNKRK',
    'KRKNNNNNNKRK',
    'KRKKKKKKKKRK',
    'KRRRRRRRRRRK',
    '.KKKKKKKKKK.',
  ],
};

/** Botón redondo decorativo: `G` es su color. */
export const POKEDEX_BUTTON_ROWS = ['..KKKK..', '.KGGGGK.', 'KGGGGGGK', 'KGGGGGGK', 'KGGGGGGK', 'KGGGGGGK', '.KGGGGK.', '..KKKK..'];

/** Los dibujos que van como archivos estáticos en public/theme/pokemon/ (los usa el CSS como fondo). */
export const STATIC_ASSETS: ReadonlyArray<{ readonly file: string; readonly art: PaletteArt }> = [
  { file: 'clouds-back.svg', art: CLOUDS_BACK },
  { file: 'clouds-front.svg', art: CLOUDS_FRONT },
  { file: 'clouds-back-dusk.svg', art: CLOUDS_BACK_DUSK },
  { file: 'clouds-front-dusk.svg', art: CLOUDS_FRONT_DUSK },
  { file: 'grass-tufts.svg', art: GRASS_TUFTS },
  { file: 'ball.svg', art: TITLE_BALL },
];

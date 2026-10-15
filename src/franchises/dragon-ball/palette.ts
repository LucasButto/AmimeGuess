// Paleta de la piel de Dragon Ball (sesión 16): los colores que la piel usa además de los del tema base
// (`theme.colors` en config.ts), como variables --palette-*. Manga de acción: naranja y azul intensos, amarillo de
// esfera del dragón, tinta negra y papel crema. El test de contraste cubre los pares de uso (`pairs` del config).

export const DRAGON_BALL_PALETTE = {
  // Tinta y papel: los mismos valores que `text`, `border` y `surface` del tema base, con nombre propio para la piel.
  ink: '#1a1a1a',
  cream: '#fff6e5',
  white: '#ffffff',
  orange: '#f28c18',
  blue: '#1f4fa8',
  navy: '#0f2a63',
  'sky-blue': '#4aa3f0',
  // El gris azulado claro de las nubes, de la sombra de la cápsula y de los fondos de cielo de los paneles.
  cloud: '#d3e7f7',
  yellow: '#ffc21a',
  red: '#d8322a',
  'paper-shade': '#f2dfbd',
  gray: '#cfcfcf',
  // Las letras del logo de la serie: cada color va de más fuerte arriba a más apagado abajo (los títulos de las páginas).
  'logo-yellow-top': '#feef00',
  'logo-yellow-bottom': '#c59000',
  'logo-red-top': '#e7000a',
  'logo-red-bottom': '#b0060f',
  // El visor del scouter (la pantalla verde sobre fondo oscuro) y el radar del dragón.
  scouter: '#39d36b',
  'scouter-dark': '#0a2a16',
} as const;

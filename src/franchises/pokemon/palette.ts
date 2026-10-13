// Paleta GBA de la piel de Pokémon (sesión 15): los colores que la piel usa además de los del tema base
// (`theme.colors` en config.ts), como variables --palette-*. Vive aparte, sin imports, para que también la
// lea el script de los SVG del tema (npm run design:assets). El test de contraste cubre sus pares de uso.

export const POKEMON_PALETTE = {
  'sky-1': '#78c8f0',
  'sky-2': '#b8e8f8',
  'cloud-shade': '#d0e0f0',
  'grass-1': '#58b848',
  'grass-2': '#3c8c34',
  'grass-3': '#2c6c2c',
  cream: '#f8f8f0',
  ink: '#383838',
  'ink-shadow': '#a8a8a8',
  frame: '#202020',
  red: '#d83030',
  blue: '#3068c8',
  yellow: '#f8d030',
  night: '#1c2a4a',
  white: '#ffffff',
  gray: '#c8c8c8',
  orange: '#a85400',
  // Tonos de las bolas de modo (sesión 15, fase 3), además del rojo, el azul, el amarillo y el verde. El cian es
  // también el de la pantalla de la Pokédex cuando se enciende.
  violet: '#8858c8',
  cyan: '#58c8d8',
  pink: '#e878a8',
  // Cielo del amanecer y del atardecer (el de noche es `night`, con estrellas `cream`).
  dawn: '#f8b880',
  dusk: '#e87850',
} as const;

// Paleta de la piel de Naruto (sesión 17): los colores que la piel usa además de los del tema base (`theme.colors` en
// config.ts), como variables --palette-*. Pergamino, tinta y mundo ninja: papel washi, tinta casi negra, naranja apagado,
// rojo de sello, azul noche, verde hoja, madera y metal grabado. El test de contraste cubre los pares de uso (`pairs`).

export const NARUTO_PALETTE = {
  // Papel y tinta: los mismos valores que `surface` y `text` del tema base, con nombre propio para la piel.
  paper: '#f3e9d2',
  ink: '#22201c',
  white: '#ffffff',
  // El papel más oscuro (fibras, sombra de los pergaminos y chips apagados).
  'washi-shade': '#e0d2b2',
  orange: '#e07b2e',
  seal: '#b8322a',
  night: '#23334d',
  leaf: '#5f8f3e',
  // El amarillo del Rayo (ícono de naturaleza del Clásico).
  gold: '#e8c22a',
  // Pétalos de cerezo que caen en el fondo.
  sakura: '#f4a3b8',
  wood: '#8a5a33',
  'wood-dark': '#5b3a20',
  metal: '#a7adb2',
  'metal-dark': '#5f6870',
  chakra: '#2f6fc4',
  smoke: '#dcd6c8',
  // La tela de los rollos de los pergaminos y el granate de sus bandas, el cordón y el marco del papel.
  cloth: '#2f4a50',
  crimson: '#7d2a32',
} as const;

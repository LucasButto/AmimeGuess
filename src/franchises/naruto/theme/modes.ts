// Íconos de los modos de Naruto: trazos de tinta simples en una grilla de 24 × 24, dibujo propio. Cada modo tiene el suyo;
// uno que no esté en la lista usa el shuriken.

const PATHS: Record<string, string> = {
  // Un pergamino abierto con sus dos rodillos.
  clasico: 'M5 5 H19 M5 19 H19 M6 5 V19 M18 5 V19 M9 9 H15 M9 12 H15 M9 15 H13',
  // Cabeza y hombros (se rellena).
  silueta: 'M12 4 A4 4 0 1 1 11.99 4 Z M4 21 C4 15, 8 13, 12 13 C16 13, 20 15, 20 21 Z',
  // Un globo de diálogo trazado a pincel.
  frase: 'M4 6 C4 4.5, 5 4, 6.5 4 H17.5 C19 4, 20 4.5, 20 6 V13 C20 14.5, 19 15, 17.5 15 H11 L7 19 V15 H6.5 C5 15, 4 14.5, 4 13 Z',
  // Círculos que se desdibujan.
  borroso: 'M12 6 A6 6 0 1 1 11.99 6 M12 9 A3 3 0 1 1 11.99 9 M3 12 H5 M19 12 H21 M12 3 V4 M12 20 V21',
  // Un remolino de chakra.
  jutsu: 'M12 12 C12 10.5, 14 10.5, 14 12 C14 14, 11 14.5, 10 12.5 C8.5 9.5, 12 7.5, 15 8.5 C18.5 10, 18 15.5, 13.5 16.5 C8.5 17.5, 5.5 13, 7 9 C8.5 5, 13 4, 16.5 5',
  // Un ojo genérico, con la pupila redonda.
  ojo: 'M3 12 C6 7, 18 7, 21 12 C18 17, 6 17, 3 12 Z M12 9.5 A2.5 2.5 0 1 1 11.99 9.5 Z',
  // Tres cabezas: un equipo.
  equipo: 'M7 8 A2.5 2.5 0 1 1 6.99 8 M17 8 A2.5 2.5 0 1 1 16.99 8 M12 6 A2.5 2.5 0 1 1 11.99 6 M3 19 C3 15, 5 13.5, 7 13.5 M21 19 C21 15, 19 13.5, 17 13.5 M7 19 C7 14.5, 9.5 12.5, 12 12.5 C14.5 12.5, 17 14.5, 17 19',
  // Una cara sonriente.
  emoji: 'M12 4 A8 8 0 1 1 11.99 4 M9 10 V10.5 M15 10 V10.5 M8.5 14 C10 16.5, 14 16.5, 15.5 14',
  // El tablón: cuatro papeles clavados.
  conexiones: 'M4 4 H11 V11 H4 Z M13 4 H20 V11 H13 Z M4 13 H11 V20 H4 Z M13 13 H20 V20 H13 Z',
  // Una línea con marcas a distintas alturas: sucesos en orden.
  'linea-de-tiempo': 'M3 12 H21 M6 12 V8 M11 12 V5 M16 12 V9 M20 12 V7',
};

const SHURIKEN = 'M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z';

/** El trazo del ícono de un modo y si se rellena (la silueta) o es solo línea. */
export function modeIcon(slug: string): { d: string; filled: boolean } {
  return { d: PATHS[slug] ?? SHURIKEN, filled: slug === 'silueta' || !(slug in PATHS) };
}

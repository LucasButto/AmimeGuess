// Íconos de los modos de Naruto: los objetos de la hoja de íconos (public/icons/naruto/<nombre>.webp). Cada modo tiene el suyo;
// uno que no esté en la lista usa el shuriken.

const ICONS: Record<string, string> = {
  clasico: 'pergamino-abierto',
  silueta: 'mascara-anbu',
  frase: 'pergamino-cerrado',
  borroso: 'bomba-humo',
  jutsu: 'rasengan',
  ojo: 'sharingan',
  equipo: 'banda-konoha',
  emoji: 'ramen',
  conexiones: 'nota-explosiva',
  'linea-de-tiempo': 'banda-suna',
};

/** El archivo del ícono de un modo (un objeto de la hoja, con fondo transparente). */
export function modeIcon(slug: string): string {
  return `/icons/naruto/${ICONS[slug] ?? 'shuriken'}.webp`;
}

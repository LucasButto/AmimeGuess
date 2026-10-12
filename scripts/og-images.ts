// node scripts/og-images.ts
//
// Crea una sola vez las imágenes para compartir en redes (Open Graph, 1200 × 630) en public/og/: la del
// inicio y una por franquicia. Son archivos estáticos; el sitio no las genera en cada visita ni usa funciones
// de Vercel (SPEC 9). Dibujo propio: ningún logotipo ni tipografía oficial.
//
// Los colores repiten los del tema de cada franquicia (src/franchises/<slug>/config.ts). Si un tema cambia, hay
// que volver a correr este script y subir los PNG; no corre en el build.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'og');
const WIDTH = 1200;
const HEIGHT = 630;

interface Card {
  readonly file: string;
  readonly title: string;
  readonly subtitle: string;
  readonly bg: readonly [string, string];
  readonly text: string;
  readonly accent: string;
  readonly font: string;
  /** Adorno de fondo (SVG) dentro del lienzo de 1200 × 630. */
  readonly art: string;
}

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const HEAVY = 'Impact, "Arial Black", system-ui, sans-serif';

const CARDS: readonly Card[] = [
  {
    file: 'inicio',
    title: 'AnimeGuess',
    subtitle: 'Un reto nuevo cada día',
    bg: ['#1b2a4a', '#0f1a33'],
    text: '#ffffff',
    accent: '#f2b632',
    font: SANS,
    art: '<rect x="70" y="70" width="1060" height="490" rx="28" fill="none" stroke="#f2b632" stroke-width="6" opacity="0.7"/><rect x="100" y="100" width="1000" height="430" rx="18" fill="none" stroke="#f2b632" stroke-width="2" opacity="0.4"/>',
  },
  {
    file: 'pokemon',
    title: 'Pokémon',
    subtitle: 'Juegos diarios · AnimeGuess',
    bg: ['#cfe9ff', '#e6f4ff'],
    text: '#10263d',
    accent: '#1565c0',
    font: SANS,
    art: '<circle cx="1000" cy="120" r="110" fill="#fff6c2"/><g fill="#ffffff"><ellipse cx="210" cy="140" rx="130" ry="38"/><ellipse cx="150" cy="115" rx="64" ry="42"/><ellipse cx="250" cy="100" rx="76" ry="50"/></g><path d="M0 520 C 240 470 460 500 700 540 S 1040 560 1200 500 V630 H0 Z" fill="#cde9b3"/><path d="M0 575 C 300 530 600 575 900 590 S 1100 590 1200 570 V630 H0 Z" fill="#dcf1c8"/>',
  },
  {
    file: 'dragon-ball',
    title: 'DRAGON BALL',
    subtitle: 'JUEGOS DIARIOS · ANIMEGUESS',
    bg: ['#08153a', '#0b2260'],
    text: '#fff6e5',
    accent: '#ff9422',
    font: HEAVY,
    art: '<g fill="#ff9422" opacity="0.28"><polygon points="0,630 1200,90 1200,170"/><polygon points="0,630 1200,260 1200,300"/><polygon points="0,630 880,0 980,0"/><polygon points="0,630 560,0 590,0"/></g>',
  },
  {
    file: 'naruto',
    title: 'Naruto',
    subtitle: 'Juegos diarios · AnimeGuess',
    bg: ['#efe5cb', '#dccda4'],
    text: '#2b2013',
    accent: '#963f08',
    font: SERIF,
    art: '<circle cx="980" cy="150" r="130" fill="#c9722f" opacity="0.3"/><path d="M-10 540 C 180 480 360 560 560 530 S 900 480 1090 540 S 1180 580 1210 560 V640 H-10 Z" fill="#2b2013" opacity="0.14"/><path d="M60 120 C 220 70 340 130 460 100 L 450 120 C 340 160 210 110 70 150 Z" fill="#2b2013" opacity="0.12"/>',
  },
  {
    file: 'yugioh',
    title: 'YU-GI-OH',
    subtitle: 'JUEGOS DIARIOS · ANIMEGUESS',
    bg: ['#17102b', '#0c0a12'],
    text: '#f3ead2',
    accent: '#e0b43c',
    font: SERIF,
    art: '<g fill="none" stroke="#e0b43c" stroke-width="4" opacity="0.6"><path d="M50 150 V50 Q50 32 68 32 H170"/><path d="M1150 150 V50 Q1150 32 1132 32 H1030"/><path d="M50 480 V580 Q50 598 68 598 H170"/><path d="M1150 480 V580 Q1150 598 1132 598 H1030"/></g><g fill="none" stroke="#e0b43c" stroke-width="2" opacity="0.18"><path d="M600 40 L790 315 L600 590 L410 315 Z"/><circle cx="600" cy="315" r="200"/></g>',
  },
];

function svg(card: Card): string {
  const sizeTitle = card.file === 'inicio' ? 150 : 130;
  const letterSpacing = card.font === SERIF || card.font === HEAVY ? 6 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${card.bg[0]}"/><stop offset="1" stop-color="${card.bg[1]}"/></linearGradient></defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  ${card.art}
  <text x="600" y="330" text-anchor="middle" font-family='${card.font}' font-size="${sizeTitle}" font-weight="700" letter-spacing="${letterSpacing}" fill="${card.text}">${card.title}</text>
  <rect x="440" y="372" width="320" height="8" rx="4" fill="${card.accent}"/>
  <text x="600" y="446" text-anchor="middle" font-family='${card.font}' font-size="40" letter-spacing="${letterSpacing / 2}" fill="${card.text}" opacity="0.9">${card.subtitle}</text>
</svg>`;
}

await mkdir(OUT, { recursive: true });
for (const card of CARDS) {
  const file = path.join(OUT, `${card.file}.png`);
  await sharp(Buffer.from(svg(card))).png({ compressionLevel: 9, palette: true }).toFile(file);
  console.log(`✅ ${path.relative(ROOT, file)}`);
}

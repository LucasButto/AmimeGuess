// Dibuja el ícono "copiar" del versus (dos hojas superpuestas) en el estilo de los demás íconos de Retro Battle: contorno negro grueso,
// relleno azul brillante con degradé y destellos blancos. No venía en la hoja de íconos que se recortó con extract-icons.py.
//
// Salida: public/img/versus/icons/copy.png (128 × 128, fondo transparente, como los otros íconos chicos).
// Origen: dibujo propio de este proyecto (sin material de terceros).
//
// Uso:  node scripts/versus/make-copy-icon.mjs      (necesita sharp, que ya es dependencia del proyecto)
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/img/versus/icons/copy.png');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="back" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#2a78d8"/>
    </linearGradient>
    <linearGradient id="front" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b8e6ff"/><stop offset="0.45" stop-color="#4fb0ff"/><stop offset="1" stop-color="#1f66cf"/>
    </linearGradient>
  </defs>
  <!-- La hoja de atrás -->
  <rect x="12" y="8" width="64" height="78" rx="12" fill="url(#back)" stroke="#0a0a14" stroke-width="8"/>
  <rect x="21" y="17" width="40" height="6" rx="3" fill="#e9f7ff" opacity="0.8"/>
  <!-- La hoja de adelante -->
  <rect x="42" y="36" width="72" height="84" rx="12" fill="url(#front)" stroke="#0a0a14" stroke-width="8"/>
  <rect x="51" y="45" width="46" height="6" rx="3" fill="#ffffff" opacity="0.9"/>
  <!-- Las rayas del texto -->
  <rect x="56" y="66" width="44" height="8" rx="4" fill="#ffffff"/>
  <rect x="56" y="82" width="44" height="8" rx="4" fill="#ffffff"/>
  <rect x="56" y="98" width="28" height="8" rx="4" fill="#ffffff"/>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(OUT);
console.log(`Escrito ${OUT}`);

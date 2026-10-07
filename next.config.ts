import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Red de seguridad: el sitio no depende de la optimización de imágenes de
  // Vercel (SPEC sección 7, "Cómo se sirven"). Las imágenes son archivos
  // estáticos de public/ servidos con <img> nativo.
  images: { unoptimized: true },
  // Permite `@use 'tokens'` en vez de rutas relativas largas.
  sassOptions: {
    loadPaths: [path.join(process.cwd(), 'src', 'styles')],
  },
};

export default nextConfig;

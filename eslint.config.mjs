import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const noNextImage =
  'Prohibido next/image: la optimización de imágenes de Vercel tiene cupo y el sitio tiene que seguir funcionando aunque se agote. Usá la etiqueta <img> nativa sobre archivos de public/ (SPEC sección 7, "Cómo se sirven").';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Las imágenes se muestran con <img> nativo por diseño; esta regla sugeriría reemplazarlo.
      '@next/next/no-img-element': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'next/image', message: noNextImage },
            { name: 'next/legacy/image', message: noNextImage },
          ],
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
]);

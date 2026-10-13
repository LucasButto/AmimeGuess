import type { MetadataRoute } from 'next';
import { franchises } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { modeStatus } from './[franchise]/[mode]/playable';
import { SITE_URL } from './site';

// Se genera al compilar (es un archivo estático). Lista el inicio, los créditos, cada franquicia y solo los modos
// que se pueden jugar: los ocultos por falta de contenido no tienen nada que mostrar.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = await Promise.all(
    franchises.map(async (franchise) => {
      const data = await loadFranchiseData(franchise.slug);
      const modes = franchise.modes
        .filter((mode) => modeStatus(franchise, mode, data) === 'playable')
        .map((mode) => ({ url: `${SITE_URL}/${franchise.slug}/${mode.slug}`, changeFrequency: 'daily' as const, priority: 0.6 }));
      return [{ url: `${SITE_URL}/${franchise.slug}`, changeFrequency: 'daily' as const, priority: 0.8 }, ...modes];
    }),
  );
  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/creditos`, changeFrequency: 'monthly', priority: 0.2 },
    ...routes.flat(),
  ];
}

import { franchises } from '@/franchises';
import { loadFranchiseData, type FranchiseData } from '@/franchises/data';
import type { SiteCatalog } from './site';

// Los datos de cada franquicia se cargan una vez (son un chunk aparte) y se reusan: al abrir la hoja "Agregar partida" y al
// validar la sala antes de crearla.
const cache = new Map<string, Promise<FranchiseData | undefined>>();

export function dataOf(slug: string): Promise<FranchiseData | undefined> {
  let promise = cache.get(slug);
  if (!promise) {
    promise = loadFranchiseData(slug);
    cache.set(slug, promise);
    promise.catch(() => cache.delete(slug));
  }
  return promise;
}

/** Las franquicias activas y los datos de las que se piden, para validar una sala con `isValidForSite`. */
export async function loadCatalog(slugs: readonly string[]): Promise<SiteCatalog> {
  const data: Record<string, FranchiseData | undefined> = {};
  await Promise.all([...new Set(slugs)].map(async (slug) => {
    data[slug] = await dataOf(slug);
  }));
  return { franchises, data };
}

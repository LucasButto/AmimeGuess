import type { Content, Entity } from '../engine/types';

export interface FranchiseData {
  entities: Entity[];
  contents: Content[];
}

// Los datos de cada franquicia se cargan con import dinámico, solo en sus
// rutas: así el JSON (~1 MB para Pokémon) viaja en un chunk aparte y no en el
// bundle de las demás páginas. Cada sesión de datos suma su franquicia acá.
const loaders: Record<string, () => Promise<FranchiseData>> = {
  pokemon: async () => {
    const [entities, contents] = await Promise.all([
      import('../../data/pokemon/entities.json'),
      import('../../data/pokemon/content.json'),
    ]);
    // Los JSON los genera y valida scripts/data/pokemon con los esquemas de Entity y Content.
    return { entities: entities.default as Entity[], contents: contents.default as Content[] };
  },
};

/** ¿Hay datos generados para esta franquicia? Las que aún no, muestran "Próximamente". */
export function hasFranchiseData(slug: string): boolean {
  return slug in loaders;
}

export async function loadFranchiseData(slug: string): Promise<FranchiseData | undefined> {
  return loaders[slug]?.();
}

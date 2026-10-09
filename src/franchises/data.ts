import { publishableContents } from '../engine/filters';
import type { Content, Entity } from '../engine/types';

export interface FranchiseData {
  /** Las entidades principales de la franquicia: lo que se adivina en el modo principal. */
  entities: Entity[];
  /** Solo lo que puede entrar a un pool: las frases y los sucesos sin verificar ya no están (ver `publishableContents`). */
  contents: Content[];
  /**
   * Otras clases de entidad que se adivinan en algunos modos, por nombre (por ejemplo, las
   * transformaciones de Dragon Ball). Un modo las elige con `ModeConfig.entitySet`.
   */
  entitySets?: Readonly<Record<string, Entity[]>>;
}

// Los datos de cada franquicia se cargan con import dinámico, solo en sus
// rutas: así el JSON (~1 MB para Pokémon) viaja en un chunk aparte y no en el
// bundle de las demás páginas. Cada sesión de datos suma su franquicia acá.
// Los JSON los genera y valida scripts/data/<franquicia> con los esquemas de Entity y Content.
const loaders: Record<string, () => Promise<FranchiseData>> = {
  pokemon: async () => {
    const [entities, contents] = await Promise.all([
      import('../../data/pokemon/entities.json'),
      import('../../data/pokemon/content.json'),
    ]);
    return { entities: entities.default as Entity[], contents: publishableContents(contents.default as Content[]) };
  },
  'dragon-ball': async () => {
    const [entities, transformations, contents] = await Promise.all([
      import('../../data/dragon-ball/entities.json'),
      import('../../data/dragon-ball/transformations.json'),
      import('../../data/dragon-ball/content.json'),
    ]);
    return {
      entities: entities.default as Entity[],
      contents: publishableContents(contents.default as Content[]),
      entitySets: { transformations: transformations.default as Entity[] },
    };
  },
  naruto: async () => {
    const [entities, contents] = await Promise.all([
      import('../../data/naruto/entities.json'),
      import('../../data/naruto/content.json'),
    ]);
    return { entities: entities.default as Entity[], contents: publishableContents(contents.default as Content[]) };
  },
  // Los duelistas son las entidades principales; las cartas insignia, un conjunto aparte (`cards`).
  yugioh: async () => {
    const [entities, cards, contents] = await Promise.all([
      import('../../data/yugioh/entities.json'),
      import('../../data/yugioh/cards.json'),
      import('../../data/yugioh/content.json'),
    ]);
    return {
      entities: entities.default as Entity[],
      contents: publishableContents(contents.default as Content[]),
      entitySets: { cards: cards.default as Entity[] },
    };
  },
};

/** ¿Hay datos generados para esta franquicia? Las que aún no, muestran "Próximamente". */
export function hasFranchiseData(slug: string): boolean {
  return slug in loaders;
}

export async function loadFranchiseData(slug: string): Promise<FranchiseData | undefined> {
  return loaders[slug]?.();
}

/** Las entidades que usa un modo: las de su conjunto con nombre, o las principales de la franquicia. */
export function entitiesOfMode(data: FranchiseData, entitySet: string | undefined): Entity[] {
  if (entitySet === undefined) return data.entities;
  return data.entitySets?.[entitySet] ?? [];
}

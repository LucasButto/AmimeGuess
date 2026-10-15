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
    const [entities, transformations, power, contents] = await Promise.all([
      import('../../data/dragon-ball/entities.json'),
      import('../../data/dragon-ball/transformations.json'),
      import('../../data/dragon-ball/power.json'),
      import('../../data/dragon-ball/content.json'),
    ]);
    return {
      entities: entities.default as unknown as Entity[],
      contents: publishableContents(contents.default as Content[]),
      // `power`: las entradas de Nivel de poder (personajes y formas en un momento de la historia, con su ki).
      entitySets: { transformations: transformations.default as unknown as Entity[], power: power.default as unknown as Entity[] },
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

/**
 * Lo que la persona deja afuera con los interruptores de la partida: lo de relleno (lo que está en el anime o en sus
 * películas pero no en el manga) y lo de los arcos del manga que todavía no se adaptaron al anime.
 */
export interface DataFlags {
  readonly skipFiller: boolean;
  readonly skipMangaOnly: boolean;
}

/** ¿Lleva la marca? En una entidad es un atributo en 1; en un contenido, un campo del `payload` en `true`. */
const marked = (value: unknown): boolean => value === 1 || value === true;

/**
 * Los datos sin lo que dejan afuera los interruptores: entidades (principales y de cada conjunto) con `filler` o
 * `mangaOnly` en sus atributos, y contenidos con esas marcas en el `payload`. Sin nada que dejar afuera, los mismos datos.
 */
export function withoutFlagged(data: FranchiseData, flags: DataFlags): FranchiseData {
  if (!flags.skipFiller && !flags.skipMangaOnly) return data;
  const keep = (bag: Readonly<Record<string, unknown>>) =>
    !(flags.skipFiller && marked(bag.filler)) && !(flags.skipMangaOnly && marked(bag.mangaOnly));
  return {
    entities: data.entities.filter((entity) => keep(entity.attrs)),
    contents: data.contents.filter((content) => keep(content.payload)),
    entitySets:
      data.entitySets && Object.fromEntries(Object.entries(data.entitySets).map(([name, list]) => [name, list.filter((entity) => keep(entity.attrs))])),
  };
}

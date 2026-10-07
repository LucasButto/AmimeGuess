// Tipos de datos del juego (SPEC sección 7). Los usan el motor, los modos y
// los scripts de datos; no dependen de ninguna franquicia.

export type SeriesId = string;
export type Localized = { es: string; en?: string };

/** Lo que se adivina: un Pokémon, un personaje, un duelista, una carta, una transformación. */
export interface Entity {
  /** Estable, kebab-case, nunca se reutiliza. */
  id: string;
  name: Localized;
  /** Para el autocompletado. */
  aliases: string[];
  series: SeriesId[];
  /** Ruta dentro de /public/img. */
  image?: string;
  attrs: Record<string, AttrValue>;
}

export type AttrValue =
  | string
  | number
  | null
  | Array<string | { value: string; series?: SeriesId }>;

/** Una pista asociada a una entidad: frase, imagen de técnica, captura, evento, grupo. */
export interface Content {
  id: string;
  /** 'quote' | 'technique' | 'screenshot' | 'event' | ... */
  kind: string;
  entityId?: string;
  /** Exactamente una serie. */
  series: SeriesId;
  payload: Record<string, unknown>;
  verified: boolean;
}

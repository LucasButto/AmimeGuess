// Configuración del motor `image-reveal` (SPEC 3.2). Es la que cada franquicia
// define en su config.ts: el motor solo la recibe y no conoce ninguna franquicia.
// Todo es JSON plano, para poder pasarlo de un componente de servidor a uno de
// cliente.

/**
 * Cómo se oculta la imagen:
 *  - `silhouette`: una sombra negra que se va iluminando.
 *  - `blur`: desenfocada, y el desenfoque baja con cada paso.
 *  - `zoom`: un recorte ampliado que se va abriendo hasta mostrar casi todo.
 */
export type RevealVariant = 'silhouette' | 'blur' | 'zoom';

export interface ImageRevealConfig {
  readonly variant: RevealVariant;
  /**
   * De dónde sale la imagen. Sin esto, la de la propia entidad que se adivina
   * (`Entity.image`, una imagen cuadrada).
   *
   * Con un `kind`, las imágenes son las de los contenidos de ese tipo cuyo
   * `entityId` es la respuesta, así que la imagen puede ser de otra cosa que la
   * respuesta (por ejemplo, una carta cuya respuesta es su Pokémon o su
   * duelista). De cada contenido se lee `payload.image` (ruta dentro de
   * /public/img, sin tamaño ni extensión), y de forma opcional `payload.width` y
   * `payload.height` (medidas del archivo más grande) y `payload.focus`
   * (`{ x, y }` entre 0 y 1, el punto que el zoom abre primero). Un Pokémon con
   * varias imágenes usa una por día, elegida de forma determinista.
   */
  readonly imageContentKind?: string;
}

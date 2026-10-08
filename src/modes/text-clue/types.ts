// Configuración del motor `text-clue` (SPEC 3.2). Es la que cada franquicia
// define en su config.ts: el motor solo la recibe y no conoce ninguna franquicia.
// Todo es JSON plano, para poder pasarlo de un componente de servidor a uno de
// cliente.

/** Cómo se dibuja el texto de una pista: `emoji` lo agranda, para las pistas hechas de emojis. */
export type ClueDisplay = 'text' | 'emoji';

/**
 * Una línea de pistas. Las que tienen `after: 0` son la pista principal y se
 * ven desde el principio; las demás se desbloquean tras `after` intentos
 * fallidos. Una línea cuyo dato no existe para la respuesta de ese día no se
 * muestra: ni abierta ni bloqueada.
 */
export type TextClueLine =
  | {
      readonly kind: 'content';
      readonly label: string;
      readonly after: number;
      /** Campo de texto del `payload` del contenido que se muestra. */
      readonly field: string;
      readonly display?: ClueDisplay;
    }
  | {
      readonly kind: 'attr';
      readonly label: string;
      readonly after: number;
      /** Atributos de la entidad respuesta que se muestran juntos, separados por " / ". Los que no tienen valor se omiten. */
      readonly keys: readonly string[];
    };

export interface TextClueConfig {
  /**
   * `kind` de los contenidos con la pista. La respuesta es la entidad dueña
   * del contenido (`entityId`). Si una entidad tiene varios, usa uno por día,
   * elegido de forma determinista.
   *
   * Un contenido puede traer `payload.accepts`, una lista de ids de otras
   * entidades que también son respuestas correctas: sirve cuando la pista es
   * igual de cierta para más de una (un movimiento que aprende toda una línea
   * evolutiva).
   */
  readonly contentKind: string;
  /** Al menos una con `after: 0`: la pista principal. */
  readonly lines: readonly TextClueLine[];
}

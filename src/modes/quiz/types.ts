// Configuración del motor `quiz` (SPEC 3.2). Es la que cada franquicia define en su config.ts: el motor solo la
// recibe y no conoce ninguna franquicia. Todo es JSON plano, para poder pasarlo de un componente de servidor a uno
// de cliente.

/** Intentos por pregunta, si `try` de data/mode.json no dice otra cosa: una sola respuesta. */
export const DEFAULT_ATTEMPTS = 1;

/** Opciones por pregunta, si la configuración no dice otra cosa: la correcta y 11 distractores. */
export const DEFAULT_OPTIONS = 12;

export interface QuizConfig {
  /**
   * `kind` de los contenidos que son las preguntas. Una pregunta no tiene entidad dueña: su respuesta correcta y
   * sus distractores son entidades (las opciones), y su serie decide si puede salir (regla 2 de la SPEC).
   */
  readonly contentKind: string;
  /** Campo del `payload` con el texto de la pregunta. */
  readonly questionField: string;
  /** Campo del `payload` con el id de la entidad que es la única respuesta correcta. */
  readonly correctField: string;
  /** Campo del `payload` con los ids de las entidades que son opciones incorrectas: de ahí salen las demás opciones. */
  readonly distractorsField: string;
  /** Campo del `payload` con el dato que explica la respuesta y se muestra al terminar (opcional). */
  readonly explanationField?: string;
  /** Campo del `payload` con el alcance de la pregunta ("Anime de Dragon Ball Z, saga de los Saiyajin"), opcional. */
  readonly scopeField?: string;
  /** Opciones por pregunta (la correcta y las demás, que salen de sus distractores). Por defecto, `DEFAULT_OPTIONS`. */
  readonly options?: number;
}

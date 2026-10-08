// Configuración del motor `reveal-list` (SPEC 3.2). Es la que cada franquicia
// define en su config.ts: el motor solo la recibe y no conoce ninguna franquicia.
// Todo es JSON plano, para poder pasarlo de un componente de servidor a uno de
// cliente.

export interface RevealListConfig {
  /**
   * `kind` de los contenidos con la lista de pistas. La respuesta es la entidad
   * dueña del contenido (`entityId`), que no tiene por qué ser una de las que
   * aparecen en la lista: por ejemplo, el miembro que falta de un equipo. Si una
   * entidad tiene varios, usa uno por día, elegido de forma determinista.
   *
   * Un contenido puede traer `payload.accepts`, una lista de ids de otras
   * entidades que también son respuestas correctas.
   */
  readonly contentKind: string;
  /** Campo del `payload` con la lista de pistas (un arreglo de textos), en el orden en que se revelan. */
  readonly field: string;
  /** Título de la lista: "Movimientos", "Miembros"… */
  readonly label: string;
  /** Pistas que se ven al empezar. Por defecto, 1: cada intento fallido revela una más. */
  readonly initial?: number;
}

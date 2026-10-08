// Configuración del motor `timeline` (SPEC 3.2). Es la que cada franquicia
// define en su config.ts: el motor solo la recibe y no conoce ninguna franquicia.
// Todo es JSON plano, para poder pasarlo de un componente de servidor a uno de
// cliente.

/** Sucesos por reto, si la configuración no dice otra cosa. */
export const DEFAULT_COUNT = 5;
/** Intentos de ordenar, si la configuración no dice otra cosa. */
export const DEFAULT_ATTEMPTS = 4;

export interface TimelineConfig {
  /**
   * `kind` de los contenidos que son los sucesos a ordenar. Cada uno trae en su
   * `payload` un texto y su lugar en la cronología (`order`: el menor ocurre
   * antes). Sin entidad dueña: la respuesta es el orden, no una entidad.
   */
  readonly contentKind: string;
  /** Campo del `payload` con el texto del suceso. */
  readonly textField: string;
  /** Campo del `payload` con su lugar en la cronología: un número, y no puede haber dos iguales entre los de un reto. */
  readonly orderField: string;
  /** Cuántos sucesos se ordenan por reto. Por defecto, `DEFAULT_COUNT`. */
  readonly count?: number;
  /** Cuántas veces se puede confirmar un orden. Por defecto, `DEFAULT_ATTEMPTS`. */
  readonly attempts?: number;
}

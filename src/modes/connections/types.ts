// Configuración del motor `connections` (SPEC 3.2). Es la que cada franquicia
// define en su config.ts: el motor solo la recibe y no conoce ninguna franquicia.
// Todo es JSON plano, para poder pasarlo de un componente de servidor a uno de
// cliente.

/** Elementos de cada grupo, y columnas de la grilla. */
export const GROUP_SIZE = 4;
/**
 * Dificultades de los grupos. Un tablero lleva exactamente un grupo de cada una (4 grupos de
 * 4 = 16 elementos), de la más fácil (1) a la más difícil (4).
 */
export const DIFFICULTIES: readonly number[] = [1, 2, 3, 4];
/** Errores permitidos por tablero, si la configuración no dice otra cosa. */
export const DEFAULT_MISTAKES = 4;

export interface ConnectionsConfig {
  /**
   * `kind` de los contenidos que son los grupos. Un grupo no tiene entidad dueña: sus
   * miembros son entidades (los elementos del tablero) y su serie decide si se puede usar
   * (regla 2 de la SPEC).
   */
  readonly contentKind: string;
  /** Campo del `payload` con el nombre del grupo: se muestra al resolverlo. */
  readonly nameField: string;
  /**
   * Campo del `payload` con los ids de TODAS las entidades que pertenecen al grupo, no solo
   * las que podrían salir en un tablero. De ahí sale la solución única: un elemento no puede
   * entrar al tablero si pertenece a otro de los grupos elegidos.
   */
  readonly membersField: string;
  /** Campo del `payload` con la dificultad del grupo, de 1 a 4. */
  readonly difficultyField: string;
  /** Errores permitidos. Por defecto, `DEFAULT_MISTAKES`. */
  readonly mistakes?: number;
}

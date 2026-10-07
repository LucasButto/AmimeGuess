// Configuración del motor `classic` (SPEC 3.2 y 3.4). Es la que cada franquicia
// define en su config.ts: el motor solo la recibe y no conoce ninguna franquicia.
// Todo es JSON plano, para poder pasarlo de un componente de servidor a uno de
// cliente.

export type CompareKind = 'exact' | 'set' | 'ordered';

export interface ClassicColumn {
  /** Clave del atributo en `Entity.attrs`. */
  readonly key: string;
  readonly label: string;
  /** `exact` (=), `set` (⊂) u `ordered` (↕, con flecha). */
  readonly compare: CompareKind;
  /** Unidad que se agrega al valor, por ejemplo `m` o `kg`. */
  readonly unit?: string;
  /**
   * Columna condicional: solo se muestra cuando todas las series activas están
   * en esta lista (por ejemplo, un dato que solo existe para las primeras
   * generaciones). Sin esto, la columna se muestra siempre.
   */
  readonly onlyForSeries?: readonly string[];
}

/** Una pista que se desbloquea tras `after` intentos fallidos. */
export type ClassicHint =
  | {
      kind: 'attr';
      readonly label: string;
      readonly after: number;
      /** Atributo de la respuesta que se revela. */
      readonly key: string;
    }
  | {
      kind: 'content';
      readonly label: string;
      readonly after: number;
      /** `kind` de los Content asociados a la respuesta. */
      readonly contentKind: string;
      /** Campo de texto del `payload` que se muestra. */
      readonly field: string;
    };

export interface ClassicConfig {
  readonly columns: readonly ClassicColumn[];
  readonly hints: readonly ClassicHint[];
}

// Configuración del motor `higher-lower` (SPEC 3.2). Es la que cada franquicia
// define en su config.ts: el motor solo la recibe y no conoce ninguna franquicia.
// Todo es JSON plano, para poder pasarlo de un componente de servidor a uno de
// cliente.

/** Lo que se compara en una partida: un atributo numérico de las entidades. */
export interface HigherLowerMetric {
  /** Clave del atributo numérico en `Entity.attrs`. */
  readonly key: string;
  /** Nombre de la métrica, para la ayuda y para mostrar los valores. */
  readonly label: string;
  /** La pregunta de cada ronda, escrita como corresponde a la métrica: "¿Cuál pesa más?". */
  readonly question: string;
  /** Unidad que se agrega al valor, por ejemplo `kg`. */
  readonly unit?: string;
}

export interface HigherLowerConfig {
  /**
   * Las métricas que se alternan: cada día se juega una (la del número de día
   * módulo la cantidad de métricas). Solo entran al pool las entidades que
   * tienen un valor numérico en todas, así cualquier día se puede jugar.
   */
  readonly metrics: readonly HigherLowerMetric[];
}

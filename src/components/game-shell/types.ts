/**
 * CONTRATO DE MOTOR
 * =================
 *
 * `GameShell` es el marco que comparten todos los juegos de una franquicia
 * (SPEC 9). Resuelve lo que no depende del motor y se lo entrega ya resuelto:
 *
 *   - los filtros por serie (parámetro `s` de la URL > localStorage > todas),
 *     con su panel y el botón de copiar link;
 *   - el número de día, con el reinicio a medianoche de Argentina;
 *   - la navegación entre los modos de la franquicia, con "resuelto hoy";
 *   - las estadísticas y la racha, que suma al terminar una partida;
 *   - el "Cómo se juega", la cuenta regresiva y el "Ayer fue…";
 *   - el resumen del resultado y el botón "Compartir resultado".
 *
 * Para integrarse, un motor le da al marco (ver `GameShellProps`):
 *
 *   1. `poolSize` y `minimumPool`: cuántas opciones quedan elegibles con las
 *      series activas y el mínimo para jugar (regla 6 de la SPEC). Si no
 *      alcanza, el marco muestra el aviso y no monta el juego.
 *   2. `yesterday`: la respuesta de ayer para la misma combinación de filtros.
 *   3. `help`: el contenido del "Cómo se juega" propio del motor. El marco le
 *      agrega al final lo común a todos (reto diario y filtros).
 *   4. `children`: una función que recibe la `GameSession` y devuelve el
 *      juego. El marco lo vuelve a montar solo cuando cambia la combinación de
 *      filtros o el día, así que el motor no tiene que reaccionar a eso.
 *
 * Y el juego tiene que cumplir estas reglas con la `GameSession` que recibe:
 *
 *   a. Guarda su partida con `writeState` (src/engine/storage.ts) bajo el
 *      contexto `{ franchise, mode, filterKey, day }` de la sesión, con
 *      `result` en `'playing' | 'won' | 'lost'`. El marco la lee para marcar
 *      "resuelto hoy" en la navegación. Mayor o Menor guarda además su récord
 *      infinito en la clave independiente documentada en SPEC 6.
 *   b. Llama a `session.onFinish(report)` cuando el reto termina, con un
 *      `FinishReport`:
 *        - al terminar la partida: `fresh: true`. El marco suma la partida a
 *          las estadísticas y a la racha, una sola vez;
 *        - al montarse con una partida que ya estaba terminada (por ejemplo,
 *          al recargar): `fresh: false`. El marco muestra el resumen sin
 *          volver a sumarla.
 *   c. Aporta al texto compartido solo la `grid` del reporte: una línea de
 *      emojis por intento, en orden, hecha de colores. Nunca nombres, ni la
 *      respuesta, ni nada que la revele. La respuesta va aparte, en `answer`:
 *      el marco la muestra en pantalla al terminar, pero no entra al texto.
 *      La grilla usa las marcas de `SHARE_MARKS` (acierto, parcial, error),
 *      que el marco cambia por los emojis del tema al compartir (sesión 15).
 *      Un motor cuyos cuadrados son otra cosa (los colores de los grupos de
 *      Conexiones) declara `gridKind: 'colors'` y su grilla va tal cual.
 *   d. Lee `window` y `localStorage` con libertad: el marco monta el juego
 *      solo en el cliente, después de la hidratación.
 *
 * Resultados con puntaje. Mayor o Menor se completa al llegar a diez aciertos en
 * el normal y se pierde al agotar `try` fallos (uno por defecto). El infinito no tiene tope de rondas.
 * Para eso:
 *
 *   e. Declara `resultKind: 'score'` en `GameShellProps` (por defecto es
 *      `'attempts'`). El marco lo usa para el resumen, las estadísticas y el
 *      texto compartido.
 *   f. Al terminar reporta `score` (los aciertos) y el resultado real en `won`.
 *      Guarda `result: 'won' | 'lost'`; las derrotas no suman victorias ni racha
 *      de días. Las estadísticas guardan el puntaje donde otros modos guardan intentos.
 *   g. `answer.label` es una frase libre (no "Era X.") que el marco muestra tal
 *      cual; puede ir vacía. `grid` es una línea de cuadrados por cada 10 jugadas
 *      (🟩 acierto, 🟥 el error final), no una línea por intento.
 */

import type { ReactNode } from 'react';
import type { DailyContext } from '@/engine/daily';

/**
 * Cómo se mide el resultado de un modo: en `attempts` (intentos hasta acertar,
 * menos es mejor) o en `score` (aciertos seguidos, más es mejor).
 */
export type ResultKind = 'attempts' | 'score';

/** Un modo de la franquicia en la navegación. */
export interface ModeLink {
  readonly slug: string;
  readonly name: string;
  /** `false` si todavía no se puede jugar: se muestra apagado, con "próximamente". */
  readonly available: boolean;
}

/** La franquicia, con lo que el marco necesita para filtros y textos. */
export interface ShellFranchise {
  readonly slug: string;
  readonly name: string;
  /** Ids de serie en orden canónico. */
  readonly series: readonly string[];
  readonly seriesLabels: Readonly<Record<string, string>>;
  /** Un dato más de cada serie para los chips, desde `sm` (ver `FranchiseConfig.seriesDetails`). */
  readonly seriesDetails?: Readonly<Record<string, string>>;
}

/** Una respuesta del reto, lista para mostrar: la de hoy al terminar, o la de ayer. */
export interface AnswerInfo {
  readonly label: string;
  /** Imagen de la respuesta, ver `ContentImage`. */
  readonly imageStem?: string;
}

/** Lo que el motor le avisa al marco cuando la persona termina el reto del día. */
export interface FinishReport {
  readonly title?: string;
  readonly answerIsSentence?: boolean;
  readonly won: boolean;
  /** Intentos usados. En un modo de puntaje, las jugadas hechas (los aciertos más el error final). */
  readonly attempts: number;
  /** Solo en modos de puntaje (`resultKind: 'score'`): los aciertos seguidos. */
  readonly score?: number;
  /** La respuesta de hoy: el marco la muestra arriba, en el resumen, junto al botón de compartir. */
  readonly answer: AnswerInfo;
  /** Una línea de emojis por intento, en orden (en los modos de puntaje, ver la regla g). Solo colores: no puede revelar la respuesta. */
  readonly grid: readonly string[];
  /**
   * `true`: la partida terminó ahora y hay que sumarla a las estadísticas.
   * `false`: ya estaba terminada y se restauró al abrir la página.
   */
  readonly fresh: boolean;
}

/** Lo que el marco le da al juego. */
export interface GameSession {
  /** Intentos totales (o fallos permitidos en comparación y grupos). */
  readonly attemptLimit?: number;
  /** Partida extra que no cuenta para estadísticas diarias. */
  readonly practice?: boolean;
  readonly franchise: string;
  readonly mode: string;
  /** Número de día del reto, ver `getDay`. */
  readonly day: number;
  /**
   * Clave de filtro canónica (`all`, `g1.g2`…). Si el motor declaró una `variant` (por ejemplo, una dificultad), lleva
   * al final `~<variante>`: así cada variante es otra partida y guarda su estado y su reto por separado.
   */
  readonly filterKey: string;
  /**
   * Series activas, en orden canónico.
   */
  readonly active: readonly string[];
  readonly onFinish: (report: FinishReport) => void;
}

export interface GameShellProps {
  readonly franchise: ShellFranchise;
  readonly mode: { readonly slug: string; readonly name: string };
  /** Todos los modos de la franquicia, en orden. */
  readonly modes: readonly ModeLink[];
  /** Cómo se mide el resultado de este modo. Por defecto, `attempts`. */
  readonly resultKind?: ResultKind;
  /**
   * De qué está hecha la grilla para compartir: `marks` (acierto, parcial, error; se cambian por los
   * emojis del tema) o `colors` (cuadrados con otro significado, que van tal cual). Por defecto, `marks`.
   */
  readonly gridKind?: 'marks' | 'colors';
  /** Mínimo de opciones elegibles para poder jugar. */
  readonly minimumPool: number;
  /** Cuántas opciones quedan elegibles con estas series activas. */
  readonly poolSize: (active: readonly string[]) => number;
  /**
   * La respuesta de ayer para la misma combinación de filtros. Recibe el
   * contexto de HOY (`ctx.day` es el día actual); el motor resta uno.
   * `null` si no corresponde.
   */
  readonly yesterday: (ctx: DailyContext, active: readonly string[]) => AnswerInfo | null;
  /** Contenido del "Cómo se juega" propio del motor. */
  readonly help: ReactNode;
  /**
   * Una variante de la partida que elige quien juega (una dificultad, por ejemplo). Cada variante es otra partida:
   * el marco vuelve a montar el juego y reinicia el resumen al cambiarla, y la `filterKey` de la sesión la incluye.
   * Sin variante (la de siempre), nada cambia. Las estadísticas y la racha son de todo el modo.
   */
  readonly variant?: string;
  /**
   * Algo que va arriba del juego y que no se vuelve a montar al cambiar de variante (el selector de dificultad):
   * recibe cuántos hay con los filtros de ahora y el día de la partida (el de hoy o el del modo infinito).
   */
  readonly beforeGame?: (info: { readonly remaining: number; readonly day: number }) => ReactNode;
  /** El juego. */
  readonly children: (session: GameSession) => ReactNode;
}

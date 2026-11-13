'use client';

import { createContext, useContext } from 'react';
import type { PlayerView, ProgressView } from '@/versus/protocol';
import type { ConnectionStatus } from './client';
import { useVersusStore } from './store';
import type { FinishReport, VersusProgress } from '@/components/game-shell/types';
import type { Modality, Partida, VersusOptions } from '@/versus/config';

/**
 * Una partida de versus que se juega en esta página (docs/versus/03-fase-1-base.md, paso 1.6). Con esto, `GameShell`
 * juega el reto de la sala en vez del del día: día de versus, filtros y variante de la partida, sin estadísticas ni
 * modo infinito, y con un resumen corto al terminar. En la sesión 28 lo provee una página de desarrollo (sin servidor);
 * desde la 31, el proveedor de la sala.
 */
export interface VersusGame {
  /** Semilla de la sala: con el índice da el día de la partida (`versusDay`). */
  readonly seed: string;
  /** Índice de la partida, desde 1 (las de desempate siguen: 11, 12…). */
  readonly index: number;
  /** Cuántas partidas tiene la sala (para "Partida 2 de 3"). */
  readonly total: number;
  readonly modality: Modality;
  readonly partida: Partida;
  readonly options: VersusOptions;
  /** Cuándo empezó esta partida para este jugador (hora corregida del servidor, ms). */
  readonly startedAt?: number;
  /** Carrera: la hora de inicio común de la sala, para el tiempo total. */
  readonly raceStartedAt?: number;
  /** Contrarreloj: cuándo se acaba el tiempo de esta partida. */
  readonly endsAt?: number;
  /** El pedido de cierre de la sala: fin anticipado o tiempo agotado. */
  readonly stop?: 'won' | 'timeUp';
  readonly onProgress?: (progress: VersusProgress) => void;
  readonly onFinish?: (report: FinishReport) => void;
  /** La pista ya se ve (en los modos de imagen, con la imagen cargada). */
  readonly onLoaded?: () => void;
  /** Pasar a la partida siguiente (o a los resultados). Sin esto, el resumen no ofrece el botón. */
  readonly onNext?: () => void;
  /** La hora del servidor ahora (el reloj local corregido). Sin esto, la local. */
  readonly now?: () => number;
  /** Lo de la sala que muestran la barra y la tira de rivales (solo en una sala real). */
  readonly room?: VersusRoomView;
}

/** Lo que se ve de la sala mientras se juega: quiénes son, cómo van y los avisos. Nunca los intentos de los demás. */
export interface VersusRoomView {
  readonly code: string;
  readonly meId: string | undefined;
  readonly players: readonly PlayerView[];
  readonly progress: readonly ProgressView[];
  readonly status: ConnectionStatus;
  readonly notices: readonly string[];
  /** Lo que tardó el jugador en cada partida que ya terminó, en ms (Contrarreloj: el límite si se le acabó el tiempo). */
  readonly finishedMs: Readonly<Record<number, number>>;
  /** Salir del versus (abandono). */
  readonly onLeave: () => void;
}

export const VersusGameContext = createContext<VersusGame | null>(null);

/** La partida de versus de esta página, o `null` fuera de una sala. */
export function useVersusGame(): VersusGame | null {
  const provided = useContext(VersusGameContext);
  const store = useVersusStore();
  return provided ?? store.game;
}

/**
 * La variante fija de la partida de versus (la que arma el motor: `d2`, `m-peso`…), o `null` fuera de una sala. Un motor
 * con selector (dificultad, medida) la usa en vez de la elegida o guardada, y no guarda nada.
 */
export function useVersusVariant(): { readonly variant: string | undefined } | null {
  const game = useVersusGame();
  return game ? { variant: game.partida.variant } : null;
}

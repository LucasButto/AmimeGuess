'use client';

import { createContext, useState } from 'react';
import { STORAGE_PREFIX, getLocalStorage } from '@/engine/storage';

/** Un interruptor de la partida, con su ayuda (ⓘ). */
export interface GameToggle {
  readonly id: string;
  readonly label: string;
  /** Lo que explica el ⓘ que va al lado. */
  readonly help: string;
  readonly on: boolean;
  readonly onChange: (on: boolean) => void;
}

/**
 * Los interruptores que cambian qué datos entran a la partida (relleno, arcos del manga): los da `ModeGame`, que es quien
 * filtra los datos, y el marco los muestra en el panel de filtros. `variant` se suma a la del motor: cada combinación es
 * otro reto del día.
 */
export interface GameFlags {
  readonly toggles: readonly GameToggle[];
  readonly variant: string;
}

export const GameFlagsContext = createContext<GameFlags>({ toggles: [], variant: '' });

/**
 * Un interruptor guardado por franquicia (vale para todos sus modos): "1" prendido, "0" apagado y, si nunca se tocó,
 * `fallback`. Sin almacenamiento, la elección dura mientras la página siga abierta.
 */
export function useStoredFlag(name: string, franchise: string, fallback: boolean): [boolean, (on: boolean) => void] {
  const key = `${STORAGE_PREFIX}:${name}:${franchise}`;
  const [on, setOn] = useState(() => {
    try {
      const value = getLocalStorage()?.getItem(key);
      return value === '1' ? true : value === '0' ? false : fallback;
    } catch {
      return fallback;
    }
  });
  const change = (next: boolean) => {
    try {
      getLocalStorage()?.setItem(key, next ? '1' : '0');
    } catch {
      // Sin almacenamiento, queda solo en memoria.
    }
    setOn(next);
  };
  return [on, change];
}

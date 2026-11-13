'use client';

import { useSyncExternalStore } from 'react';
import type { RoomConnection } from './useVersusRoom';
import type { VersusGame } from './VersusGameContext';

// El puente entre el proveedor del versus (que vive en el layout raíz y se carga solo cuando hace falta) y las pantallas que
// lo usan (la sala de espera y el marco del juego). Es un módulo mínimo, sin zod ni el protocolo: el marco del juego lo
// importa siempre y no debe pesar. Los tipos son solo tipos (se borran al compilar).

/** Lo que la sala de espera necesita del proveedor. */
export interface RoomHandle {
  readonly code: string;
  readonly connection: RoomConnection;
  /** Se une con un apodo. */
  readonly join: (name: string) => void;
  /** Mira la sala sin unirse. */
  readonly spectate: () => void;
}

export interface VersusStoreState {
  /** El código de la sala de esta pantalla (de `v=` en una partida o de `c=` en la sala de espera), si lo hay. */
  readonly code: string | null;
  readonly handle: RoomHandle | null;
  /** La partida de versus de esta página (`?v=&p=`), cuando ya se puede jugar. */
  readonly game: VersusGame | null;
  /** Por qué no hay partida: la conexión no anda o la sala no existe. */
  readonly failure: 'unavailable' | null;
}

const EMPTY: VersusStoreState = { code: null, handle: null, game: null, failure: null };

let state: VersusStoreState = EMPTY;
const listeners = new Set<() => void>();

export function setVersusStore(next: Partial<VersusStoreState>): void {
  state = { ...state, ...next };
  for (const listener of [...listeners]) listener();
}

export function resetVersusStore(): void {
  state = EMPTY;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVersusStore(): VersusStoreState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

/** La conexión con la sala `code`, o `null` mientras el proveedor todavía no la publicó. */
export function useRoomHandle(code: string): RoomHandle | null {
  const store = useVersusStore();
  return store.handle?.code === code ? store.handle : null;
}

/** ¿La URL de esta página pide una partida de versus (`?v=`)? Solo se mira en el cliente, después de hidratar. */
export function wantsVersusGame(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('v');
}

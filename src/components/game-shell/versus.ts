'use client';

import { useEffect, useRef } from 'react';
import type { GameSession, VersusProgress } from './types';

// Lo común a todos los motores dentro de una sala de versus (reglas h, i y j de types.ts). Sin `session.versus` ni
// `session.onProgress`, cada función devuelve lo de siempre y los efectos no hacen nada.

/** Si la partida no tiene límite de intentos ni de fallos (Contrarreloj y Carrera). */
export function isUnlimited(session: Pick<GameSession, 'versus'>): boolean {
  return session.versus?.unlimited === true;
}

/** El límite con el que termina la partida: el de siempre o, sin límite, infinito. Las ayudas siguen usando `limit`. */
export function endLimit(session: Pick<GameSession, 'versus'>, limit: number): number {
  return isUnlimited(session) ? Infinity : limit;
}

/**
 * Le avisa a la sala lo que se puede mostrar a los rivales cada vez que cambia (después de cada intento). No avisa al
 * montarse una partida nueva sin intentos; sí al recargar una empezada, para que la sala sepa dónde quedó.
 */
export function useVersusProgress(session: Pick<GameSession, 'onProgress'>, progress: VersusProgress): void {
  const { onProgress } = session;
  const key = `${progress.attempts}|${progress.errors ?? ''}|${progress.score ?? ''}`;
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!onProgress || last.current === key) return;
    const first = last.current === null;
    last.current = key;
    if (first && progress.attempts === 0 && !progress.score) return;
    onProgress({ attempts: progress.attempts, ...(progress.errors === undefined ? {} : { errors: progress.errors }), ...(progress.score === undefined ? {} : { score: progress.score }) });
    // `key` resume los números: el objeto `progress` es nuevo en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onProgress, key]);
}

/**
 * Cuando la sala termina la partida desde afuera (`versus.stop`) y el juego sigue, llama a `onStop` una sola vez: el
 * motor se bloquea, muestra la respuesta y reporta el final (con `timedOut: true` si se acabó el tiempo).
 */
export function useVersusStop(session: Pick<GameSession, 'versus'>, over: boolean, onStop: (stop: 'won' | 'timeUp') => void): void {
  const stop = session.versus?.stop;
  const done = useRef(false);
  const latest = useRef(onStop);
  useEffect(() => {
    latest.current = onStop;
  });
  useEffect(() => {
    if (!stop || over || done.current) return;
    done.current = true;
    latest.current(stop);
  }, [stop, over]);
}

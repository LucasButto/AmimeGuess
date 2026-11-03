'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { usePrefs } from './usePrefs';

// Vibración corta al acertar y al fallar (SPEC 9.3), con `navigator.vibrate`. Solo si está prendida en Ajustes (apagada por
// defecto) y el navegador la ofrece: en iPhone no existe y no pasa nada.

export type Buzz = 'hit' | 'miss';

/** Un toque corto al acertar; dos al fallar (milisegundos de vibración y de pausa). */
const PATTERNS: Readonly<Record<Buzz, number | readonly number[]>> = { hit: 10, miss: [10, 40, 10] };

const noSubscribe = () => () => undefined;

/** ¿Este navegador puede vibrar? `false` en el servidor y antes de hidratar; Ajustes muestra el interruptor solo si es `true`. */
export function useCanVibrate(): boolean {
  return useSyncExternalStore(noSubscribe, () => typeof navigator.vibrate === 'function', () => false);
}

/** Vibra con el patrón pedido, `delay` milisegundos después (para que coincida con una animación). Sin soporte o apagada, no hace nada. */
export function useHaptics(): (kind: Buzz, delay?: number) => void {
  const { vibration } = usePrefs();
  return useCallback(
    (kind, delay = 0) => {
      if (!vibration || typeof navigator.vibrate !== 'function') return;
      const pattern = PATTERNS[kind];
      const run = () => navigator.vibrate(pattern as number | number[]);
      if (delay > 0) setTimeout(run, delay);
      else run();
    },
    [vibration],
  );
}

/**
 * Vibra al fallar: cada vez que `failed` sube (los fallos de la partida). Al montar toma el valor que ya hay, así una partida
 * restaurada al recargar no vibra por lo que ya había pasado.
 */
export function useMissBuzz(failed: number): void {
  const buzz = useHaptics();
  const previous = useRef(failed);
  useEffect(() => {
    if (failed > previous.current) buzz('miss');
    previous.current = failed;
  }, [failed, buzz]);
}

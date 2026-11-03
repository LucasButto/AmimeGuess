export interface Departure {
  readonly from: string;
  readonly href: string;
}

/**
 * Cuánto se espera la pantalla nueva después de navegar. Mientras tanto la salida sigue tapando (barras cerradas, humo, el
 * resplandor de Shenlong): retirarla antes mostraba de nuevo la pantalla vieja si la ruta demoraba (el teléfono con mala señal, o
 * el servidor de desarrollo compilando). Si la ruta nunca llega, a los 4 s se retira igual: no queda una cortina para siempre.
 */
export const SLOW_ROUTE_MS = 4000;

/** Una salida por vez, con vida acotada y cancelación de todos sus temporizadores. */
export function createDeparture() {
  let current: Departure | null = null;
  let navigateTimer: ReturnType<typeof setTimeout> | undefined;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = (value: Departure | null) => {
    current = value;
    for (const listener of listeners) listener();
  };
  const cancel = () => {
    clearTimeout(navigateTimer);
    clearTimeout(releaseTimer);
    navigateTimer = releaseTimer = undefined;
    if (current) publish(null);
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    snapshot: () => current,
    serverSnapshot: () => null,
    start(from: string, href: string, coverMs: number, navigate: (href: string) => void): boolean {
      if (current) return false;
      const trip = { from, href };
      publish(trip);
      navigateTimer = setTimeout(() => {
        if (current !== trip) return;
        try {
          navigate(href);
        } finally {
          // Si la ruta demora, la salida sigue tapando hasta que llegue la pantalla nueva (o hasta el tope).
          if (current === trip) releaseTimer = setTimeout(cancel, SLOW_ROUTE_MS);
        }
      }, coverMs);
      return true;
    },
    arrive(pathname: string) {
      if (current && current.from !== pathname) cancel();
    },
    cancel,
  };
}

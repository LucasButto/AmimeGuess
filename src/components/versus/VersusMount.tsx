'use client';

import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useSyncExternalStore } from 'react';
import { versusEnabled } from './enabled';

// El proveedor del versus (conexión con la sala) se carga con import dinámico y solo cuando hace falta: sin la variable
// `NEXT_PUBLIC_VERSUS_URL`, o en una página que no es del versus ni trae `v=`, no se descarga nada del versus ni se abre ninguna
// conexión. Una vez cargado, queda montado mientras se navega entre la sala y sus partidas.
const Runtime = dynamic(() => import('./VersusRuntime'), { ssr: false });

const subscribeNothing = () => () => undefined;

/** ¿Esta página necesita el proveedor? Las del versus y las partidas de una sala (`?v=`). */
function Gate() {
  const pathname = usePathname();
  // Los parámetros salen del router (no de `window.location`, que se actualiza después de renderizar la navegación).
  const params = useSearchParams();
  if (!pathname.startsWith('/versus') && !params.has('v')) return null;
  return <Runtime />;
}

export function VersusMount() {
  // La URL del servidor no tiene `window`: hasta hidratar no se monta nada. Dentro de una sala, de la sala a la partida 1 o
  // de `?p=1` a `?p=2`, el proveedor sigue montado.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted || !versusEnabled()) return null;
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}

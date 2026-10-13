'use client';

import { createContext, useContext, type MouseEvent } from 'react';
import type { ResolvedSkin } from '@/franchises/types';
import { DEFAULT_SKIN } from './defaults';

export interface SkinContextValue {
  /** Franquicia de la página, o `null` fuera de una franquicia (inicio, créditos, 404). */
  readonly slug: string | null;
  readonly skin: ResolvedSkin;
  /**
   * El elemento raíz del tema (SPEC 9.2): lleva la clase de la piel, así que todo lo que se dibuje adentro
   * hereda sus variables. Lo que se monta en un portal (las ayudas ⓘ) va acá y no a `document.body`, que
   * queda fuera del tema. `null` antes de montar y fuera de una franquicia.
   */
  readonly root: HTMLElement | null;
  /**
   * Para el `onClick` de un link a otra pantalla de la franquicia: si el tema tiene animación de salida
   * (`pageExitMs`), la reproduce y navega al terminar, y evita la navegación inmediata. Con un clic con
   * modificadores, con movimiento reducido o sin animación no hace nada y el link navega como siempre.
   */
  readonly leaveTo: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export const SkinContext = createContext<SkinContextValue>({ slug: null, skin: DEFAULT_SKIN, root: null, leaveTo: () => undefined });

/** La piel de la franquicia de la página (o la de por defecto) y su elemento raíz. */
export function useSkin(): SkinContextValue {
  return useContext(SkinContext);
}

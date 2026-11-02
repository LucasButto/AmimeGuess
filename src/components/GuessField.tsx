'use client';

import { createPortal } from 'react-dom';
import type { GuessInputProps } from '@/franchises/types';
import { InDockContext, useDockTarget } from './game-shell/GameDock';
import { useSkin } from './skin/context';

/**
 * Donde se elige el intento en los motores de adivinar: lo dibuja el slot `GuessInput` del tema (por defecto, un
 * campo de texto con sugerencias; en Pokémon, un selector con la Pokédex). Los motores no saben cuál es.
 * Con el diseño de app, por debajo de `lg`, va en la barra inferior (`#game-dock`).
 */
export function GuessField(props: GuessInputProps) {
  const { GuessInput } = useSkin().skin.slots;
  const dock = useDockTarget();
  const field = <GuessInput {...props} />;
  return dock ? createPortal(<InDockContext.Provider value>{field}</InDockContext.Provider>, dock) : field;
}

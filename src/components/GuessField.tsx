'use client';

import type { GuessInputProps } from '@/franchises/types';
import { useSkin } from './skin/context';

/**
 * Donde se elige el intento en los motores de adivinar: lo dibuja el slot `GuessInput` del tema (por defecto, un
 * campo de texto con sugerencias; en Pokémon, un selector con la Pokédex). Los motores no saben cuál es.
 */
export function GuessField(props: GuessInputProps) {
  const { GuessInput } = useSkin().skin.slots;
  return <GuessInput {...props} />;
}

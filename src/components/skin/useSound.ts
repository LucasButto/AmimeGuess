'use client';

import { useCallback } from 'react';
import type { SoundName } from '@/franchises/types';
import { usePrefs } from '../usePrefs';
import { playRecipe } from '../ui/sound';
import { useSkin } from './context';

/**
 * Toca un efecto del tema (`reveal`, `miss`, `win`) si "Sonidos" está activo y el tema tiene receta para
 * él; si no, no hace nada. Se llama desde una acción de la persona, con un retraso opcional en milisegundos.
 */
export function useSound(): (name: SoundName, delay?: number) => void {
  const { sounds } = usePrefs();
  const recipes = useSkin().skin.sounds;
  return useCallback(
    (name: SoundName, delay = 0) => {
      const recipe = recipes[name];
      if (sounds && recipe) playRecipe(recipe, delay);
    },
    [sounds, recipes],
  );
}

// Efectos de sonido sintetizados con Web Audio (SPEC 9.2): sin archivos, a partir de una receta del tema
// (forma de onda, notas y volumen). El `AudioContext` se crea recién al primer sonido, que siempre se pide
// desde una acción de la persona (enviar un intento): nunca antes ni con los sonidos apagados.

import type { SoundRecipe } from '@/franchises/types';

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const Constructor = globalThis.AudioContext as typeof AudioContext | undefined;
  if (!Constructor) return null;
  try {
    context = new Constructor();
  } catch {
    return null;
  }
  return context;
}

/** Cuánto dura una receta, en milisegundos. */
export function recipeDuration(recipe: SoundRecipe): number {
  return recipe.notes.reduce((total, note) => total + note.duration, 0);
}

/** Toca una receta dentro de `delay` milisegundos (programada en el reloj de audio, no con temporizadores). */
export function playRecipe(recipe: SoundRecipe, delay = 0): void {
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();
  let start = audio.currentTime + delay / 1000;
  for (const note of recipe.notes) {
    const seconds = note.duration / 1000;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = recipe.wave;
    oscillator.frequency.setValueAtTime(note.frequency, start);
    // Ataque y caída cortos: sin chasquidos al empezar y al cortar.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(recipe.gain, start + Math.min(0.01, seconds / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds);
    start += seconds;
  }
}

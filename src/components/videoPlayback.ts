// El estado de reproducción de un clip de contenido (ver `ContentVideo`): una máquina chica y pura, para poder probarla sin navegador.
//
//  - `idle`: todavía no se sabe (se está cargando o se acaba de pedir la reproducción).
//  - `playing`: el clip está corriendo.
//  - `paused`: lo pausó la persona (o no arrancó solo porque pidió menos movimiento).
//  - `blocked`: el navegador no dejó arrancarlo solo (por ejemplo, un iPhone con ahorro de batería): queda el póster y un botón.
//  - `failed`: el archivo no se pudo cargar o reproducir: se muestra solo el póster, como una imagen común.

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'blocked' | 'failed';

export type PlaybackEvent = 'playing' | 'paused' | 'blocked' | 'failed';

export function nextPlayback(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  // Un clip que falló no vuelve: no se vuelve a pedir un archivo roto.
  if (state === 'failed') return state;
  return event;
}

/** ¿Hay que mostrar el botón de reproducir y pausar? Con menos movimiento, si el navegador no dejó arrancarlo solo o si está en pausa: nunca queda un clip detenido sin forma de arrancarlo. */
export function showsControl(state: PlaybackState, reducedMotion: boolean): boolean {
  if (state === 'failed') return false;
  return reducedMotion || state === 'blocked' || state === 'paused';
}

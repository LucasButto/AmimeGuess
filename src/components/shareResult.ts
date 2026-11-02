// Compartir el resultado desde el teléfono: el menú del sistema si existe y, si no, copiar al portapapeles.

export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'failed';

/**
 * Comparte `text` con `navigator.share` si el navegador lo tiene. Si no lo tiene, o si falla por algo que no sea
 * cancelar (`AbortError`: la persona cerró el menú), copia con `copy`, como siempre.
 */
export async function shareOrCopy(
  text: string,
  copy: (text: string) => Promise<boolean>,
  nav: Pick<Navigator, 'share'> | { share?: undefined } = typeof navigator === 'undefined' ? {} : navigator,
): Promise<ShareOutcome> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copy(text)) ? 'copied' : 'failed';
}

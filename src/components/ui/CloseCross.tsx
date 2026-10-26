/**
 * La cruz de los botones de cerrar (el aviso del pie, los modales): un dibujo simétrico y no el carácter ✕, que se corre según
 * la tipografía y no queda centrado. Toma el color del texto del botón. Decorativa: el botón ya lleva su nombre accesible.
 */
export function CloseCross() {
  return (
    <svg viewBox="0 0 10 10" width="0.9375rem" height="0.9375rem" aria-hidden="true" focusable="false">
      <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    </svg>
  );
}

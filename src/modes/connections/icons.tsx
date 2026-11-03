// Los dos íconos de la barra inferior de Conexiones. Trazos de color `currentColor` con esquinas rectas, como el resto de la interfaz pixel.

const BASE = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true, focusable: false } as const;

/** Mezclar: las dos flechas que se cruzan (el ícono de "reproducción aleatoria" de los reproductores de música). */
export function ShuffleIcon() {
  return (
    <svg {...BASE}>
      <path d="M3 6.5h3.5c3 0 4.5 2.2 6 5.5s3 5.5 6 5.5H21" />
      <path d="M17.5 14.5l3.5 3-3.5 3" />
      <path d="M3 17.5h3.5c1.7 0 2.9-.7 3.9-2" />
      <path d="M13.6 8.6c.9-1.3 2.1-2.1 3.9-2.1H21" />
      <path d="M17.5 3.5l3.5 3-3.5 3" />
    </svg>
  );
}

/** Deseleccionar todo: un recuadro punteado con una ✕ (la selección se borra). */
export function DeselectIcon() {
  return (
    <svg {...BASE}>
      <path d="M4 4h4M10 4h4M16 4h4M4 20h4M10 20h4M16 20h4M4 4v4M4 10v4M4 16v4M20 4v4M20 10v4M20 16v4" strokeWidth={2} />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

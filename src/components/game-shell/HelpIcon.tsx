'use client';

import { ContentImage } from '../ContentImage';
import { useSkin } from '../skin/context';

/**
 * El ícono del librito de "Cómo se juega": el de imagen de la piel (`menuIcons.help`, el mismo del menú ⋮/☰) o, sin él, el
 * dibujo de píxeles de siempre. Decorativo: el nombre lo da el texto que lo acompaña.
 */
export function HelpIcon({ className }: { className?: string }) {
  const { skin } = useSkin();
  if (skin.menuIcons) return <ContentImage className={className} stem={skin.menuIcons.help} alt="" sizes="2rem" />;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M3 3h8l1 2 1-2h8v18h-8l-1 1-1-1H3z" fill="var(--game-menu-icon-edge, currentColor)" />
      <path d="M5 5h5v14H5zm9 0h5v14h-5z" fill="var(--game-menu-icon-fill, currentColor)" />
      <path d="M6 7h3v1H6zm0 4h3v1H6zm9-4h3v1h-3zm0 4h3v1h-3z" fill="var(--surface-panel)" />
    </svg>
  );
}

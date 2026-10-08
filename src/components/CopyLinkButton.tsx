'use client';

import { es } from '@/i18n/es';
import { CopyButton } from './CopyButton';
import { buildShareUrl } from './game-shell/share';

interface CopyLinkButtonProps {
  /** Clave de filtro actual (`all`, `g1.g2`…): el link siempre la lleva, para que quien lo abra vea el mismo reto. */
  filterKey: string;
}

/** Copia la dirección de la página con el parámetro `s` de los filtros activos. */
export function CopyLinkButton({ filterKey }: CopyLinkButtonProps) {
  return (
    <CopyButton
      getText={() => buildShareUrl(window.location.href, filterKey)}
      label={es.game.copyLink}
      copiedLabel={es.game.linkCopied}
      failedLabel={es.game.linkCopyFailed}
    />
  );
}

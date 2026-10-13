'use client';

import { es } from '@/i18n/es';
import { CopyButton } from './CopyButton';
import styles from './CopyLinkButton.module.scss';
import { buildShareUrl } from './game-shell/share';
import { InfoTip } from './ui/InfoTip';

interface CopyLinkButtonProps {
  /** Clave de filtro actual (`all`, `g1.g2`…): el link siempre la lleva, para que quien lo abra vea el mismo reto. */
  filterKey: string;
}

/** Copia la dirección de la página con el parámetro `s` de los filtros activos. */
export function CopyLinkButton({ filterKey }: CopyLinkButtonProps) {
  return (
    <span className={styles.group}>
      <CopyButton
        getText={() => buildShareUrl(window.location.href, filterKey)}
        label={es.game.copyLink}
        copiedLabel={es.game.linkCopied}
        failedLabel={es.game.linkCopyFailed}
      />
      <InfoTip text={es.help.copyLink} label={es.help.button(es.game.copyLink)} />
    </span>
  );
}

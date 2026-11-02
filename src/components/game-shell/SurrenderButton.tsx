'use client';

import { useEffect, useState } from 'react';
import { useAppShell, useSurrenderRegistry } from './AppShellContext';
import { es } from '@/i18n/es';
import { Modal } from '../Modal';
import { Sheet } from '../Sheet';
import { Button } from '../ui/Button';
import { useDockTarget } from './GameDock';
import styles from './SurrenderButton.module.scss';

/** Acción secundaria que conserva los marcos, colores y tipografía de la piel. */
export function SurrenderButton({ onConfirm, scored = false, disabled = false }: {
  onConfirm: () => void;
  scored?: boolean;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const appShell = useAppShell();
  // En el teléfono la confirmación es una hoja corta; en lo demás, el modal de siempre.
  const phone = useDockTarget() !== null;
  const registry = useSurrenderRegistry();
  useEffect(() => {
    if (!appShell || !registry) return;
    return registry.register({ open: () => setConfirming(true), disabled });
  }, [appShell, registry, disabled]);

  return (
    <div className={styles.root}>
      <Button variant="ghost" className={appShell ? `${styles.action} ${styles.boardAction}` : styles.action} disabled={disabled} onClick={() => setConfirming(true)} aria-haspopup="dialog">
        {es.shell.surrender.button}
      </Button>
      {confirming && !phone && (
        <Modal title={es.shell.surrender.title} onClose={() => setConfirming(false)}>
          <div className={styles.confirmation}>
            <p>{scored ? es.shell.surrender.scoreDescription : es.shell.surrender.description}</p>
            <div className={styles.actions}>
              <Button variant="ghost" className={styles.cancel} onClick={() => setConfirming(false)}>{es.shell.surrender.cancel}</Button>
              <Button variant="ghost" className={styles.action} onClick={() => {
                setConfirming(false);
                onConfirm();
              }}>{es.shell.surrender.confirm}</Button>
            </div>
          </div>
        </Modal>
      )}
      {confirming && phone && (
        <Sheet
          title={es.shell.surrender.title}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button variant="ghost" className={styles.cancel} onClick={() => setConfirming(false)}>{es.shell.surrender.cancel}</Button>
              <Button variant="ghost" className={styles.action} onClick={() => {
                setConfirming(false);
                onConfirm();
              }}>{es.shell.surrender.confirm}</Button>
            </>
          }
        >
          <p>{scored ? es.shell.surrender.scoreDescription : es.shell.surrender.description}</p>
        </Sheet>
      )}
    </div>
  );
}

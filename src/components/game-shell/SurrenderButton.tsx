'use client';

import { useState } from 'react';
import { es } from '@/i18n/es';
import { Modal } from '../Modal';
import { Button } from '../ui/Button';
import styles from './SurrenderButton.module.scss';

/** Acción secundaria que conserva los marcos, colores y tipografía de la piel. */
export function SurrenderButton({ onConfirm, scored = false, disabled = false }: {
  onConfirm: () => void;
  scored?: boolean;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={styles.root}>
      <Button variant="ghost" className={styles.action} disabled={disabled} onClick={() => setConfirming(true)} aria-haspopup="dialog">
        {es.shell.surrender.button}
      </Button>
      {confirming && (
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
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Sheet } from '@/components/Sheet';
import { promptInstall, useInstallState } from '@/components/install';
import { versusEnabled } from '@/components/versus/enabled';
import { TabPage } from '@/components/tabbar/TabPage';
import { Button } from '@/components/ui/Button';
import { es } from '@/i18n/es';
import styles from './MoreMenu.module.scss';

type Open = 'howTo' | 'install' | 'legal' | null;

/** La pestaña Más: los ajustes a la vista y, en una lista, Cómo se juega, Instalar la app, Créditos y el aviso legal. */
export function MoreMenu() {
  const [open, setOpen] = useState<Open>(null);
  const install = useInstallState();
  const { more } = es;
  const close = () => setOpen(null);
  const closeButton = <Button variant="primary" onClick={close}>{more.close}</Button>;

  function handleInstall() {
    if (install === 'prompt') void promptInstall();
    else setOpen('install');
  }

  return (
    <TabPage tab="more" title={more.title}>
      <section className={styles.settings} aria-labelledby="mas-ajustes">
        <h2 id="mas-ajustes" className={styles.heading}>{more.settings}</h2>
        <SettingsPanel />
      </section>

      <ul className={styles.list}>
        <li>
          <button type="button" className={styles.row} onClick={() => setOpen('howTo')}>
            <span className={styles.rowName}>{more.howTo}</span>
          </button>
        </li>
        {versusEnabled() && (
          <li>
            <Link className={styles.row} href="/versus" data-versus>
              <span className={styles.rowName}>{more.versus}</span>
              <span className={styles.rowHint}>{more.versusHint}</span>
            </Link>
          </li>
        )}
        <li>
          <button type="button" className={styles.row} onClick={handleInstall} disabled={install === 'installed'}>
            <span className={styles.rowName}>{install === 'installed' ? more.installed : more.install}</span>
            {install !== 'installed' && <span className={styles.rowHint}>{more.installHint}</span>}
          </button>
        </li>
        <li>
          <Link className={styles.row} href="/creditos">
            <span className={styles.rowName}>{more.credits}</span>
            <span className={styles.rowHint}>{more.creditsHint}</span>
          </Link>
        </li>
        <li>
          <button type="button" className={styles.row} onClick={() => setOpen('legal')}>
            <span className={styles.rowName}>{more.legal}</span>
          </button>
        </li>
      </ul>

      <Sheet open={open === 'howTo'} title={more.howToTitle} onClose={close} footer={closeButton}>
        <div className={styles.text}>
          <p>{more.howToIntro}</p>
          <ol>
            {more.howToSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      </Sheet>
      <Sheet open={open === 'install'} title={more.installTitle} onClose={close} footer={closeButton}>
        <div className={styles.text}>
          <p>{more.installHint}</p>
          <ol>
            {more.installSteps[install === 'ios' ? 'ios' : 'other'].map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      </Sheet>
      <Sheet open={open === 'legal'} title={more.legalTitle} onClose={close} footer={closeButton}>
        <div className={styles.text}>
          <p>{es.footer.notice}</p>
        </div>
      </Sheet>
    </TabPage>
  );
}

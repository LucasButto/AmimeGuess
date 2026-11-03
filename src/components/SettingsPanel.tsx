'use client';

import { es } from '@/i18n/es';
import styles from './SettingsPanel.module.scss';
import { useCanVibrate } from './useHaptics';
import { setPrefs, usePrefs } from './usePrefs';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';

/**
 * Los ajustes globales (tamaño de lectura, fuente legible, sonidos): iguales en el menú del juego y en la pestaña Más.
 * Cada cambio se guarda en `md:v1:prefs` y se aplica enseguida a toda la página.
 */
export function SettingsPanel() {
  const prefs = usePrefs();
  const canVibrate = useCanVibrate();
  return (
    <div className={styles.settings}>
      <fieldset className={styles.textSizes}>
        <legend>{es.settings.textSize}</legend>
        <p>{es.settings.textSizeHint}</p>
        <div className={styles.sizes}>
          {([1, 2, 3] as const).map((textScale) => (
            <Button key={textScale} className={styles.sizeChoice} variant="ghost" aria-pressed={(prefs.textScale ?? 1) === textScale} onClick={() => setPrefs({ ...prefs, textScale })}>
              {es.settings.scale(textScale)}
            </Button>
          ))}
        </div>
      </fieldset>
      <Switch label={es.settings.legibleFont} hint={es.settings.legibleFontHint} checked={prefs.legibleFont} onChange={(legibleFont) => setPrefs({ ...prefs, legibleFont })} />
      <Switch label={es.settings.sounds} hint={es.settings.soundsHint} checked={prefs.sounds} onChange={(sounds) => setPrefs({ ...prefs, sounds })} />
      {/* Solo donde el navegador puede vibrar (en iPhone no existe y el interruptor no serviría de nada). */}
      {canVibrate && (
        <Switch label={es.settings.vibration} hint={es.settings.vibrationHint} checked={prefs.vibration} onChange={(vibration) => {
          setPrefs({ ...prefs, vibration });
          // Al prenderla, un toque de prueba: así se nota que quedó andando.
          if (vibration) navigator.vibrate(10);
        }} />
      )}
    </div>
  );
}

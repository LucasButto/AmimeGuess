'use client';

import { useId, type ReactNode } from 'react';
import { DockAction } from '@/components/game-shell/GameDock';
import { HowToPlay } from '@/components/game-shell/HowToPlay';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { es } from '@/i18n/es';
import styles from './VersusHowTo.module.scss';

interface VersusHowToProps {
  franchise: string;
  mode: string;
  modeName: string;
  /** La explicación propia del motor. */
  help?: ReactNode;
  /** Cómo corre esta partida en la sala (ver `versusRulesText`). */
  rules: { readonly intro: string; readonly lines: readonly string[] };
  /** Teléfono (diseño de app): "Continuar" va en la barra de abajo, como la acción principal de cualquier modo. */
  phone: boolean;
  onContinue: () => void;
}

/**
 * La pantalla que va antes de cada modo de una sala de versus: cómo se juega y qué reglas tiene esta partida, con "Continuar".
 * El juego no se monta hasta tocarlo, así que la pista no se ve ni corre el reloj de la partida mientras se lee (en Carrera el
 * reloj de la sala ya corre: lo dice la propia pantalla). Lleva el tema de la franquicia, como el modal de ayuda: las
 * explicaciones de cada motor usan los colores de su piel.
 */
export function VersusHowTo({ franchise, mode, modeName, help, rules, phone, onContinue }: VersusHowToProps) {
  const titleId = useId();
  return (
    <Panel as="section" variant="dialog" className={styles.root} aria-labelledby={titleId} data-versus-howto="">
      <h2 className={styles.title} id={titleId}>
        {es.shell.helpTitle(modeName)}
      </h2>
      <HowToPlay franchise={franchise} mode={mode} help={help} versusRules={rules} />
      {phone ? (
        <DockAction label={es.versus.howTo.continue} onClick={onContinue} />
      ) : (
        <div>
          <Button variant="primary" onClick={onContinue}>
            {es.versus.howTo.continue}
          </Button>
        </div>
      )}
    </Panel>
  );
}

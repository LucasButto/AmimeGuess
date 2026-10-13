'use client';

import Link from 'next/link';
import { useSkin } from '@/components/skin/context';
import { PixelIcon } from '@/components/ui/icons';
import { PixelArt } from '@/components/ui/PixelArt';
import { es } from '@/i18n/es';
import type { ModeCardProps } from '../../types';
import { POKEDEX_BUTTON_ROWS, POKEDEX_DPAD, POKEDEX_LENS, POKEDEX_LIGHT_ROWS, inlineArt } from './art';
import styles from './PokedexCard.module.scss';

const LIGHTS = ['red', 'yellow', 'grass-1'] as const;
const BUTTONS = ['gray', 'frame'] as const;

/** Lo que dice la pantalla: el nombre del modo, el estado de hoy y una fila de tres celdas decorativas. */
function ScreenFace({ name, status }: { name: string; status: string }) {
  return (
    <span className={styles.face}>
      <span className={styles.screenName}>{name}</span>
      <span className={styles.screenStatus}>{status}</span>
      <span className={styles.cells} aria-hidden="true">
        <span className={styles.cell} data-match="exact">
          <PixelIcon name="check" />
        </span>
        <span className={styles.cell} data-match="partial">
          <PixelIcon name="partial" />
        </span>
        <span className={styles.cell} data-match="none">
          <PixelIcon name="cross" />
        </span>
      </span>
    </span>
  );
}

/**
 * Tarjeta del modo principal (Clásico) como una Pokédex: carcasa roja con lente, luces, pantalla azul noche
 * con el nombre del modo y su estado de hoy, y una cruceta, dos botones y un parlante. En el teléfono es
 * compacta: lente, pantalla y "Jugar". Con el cursor encima (o el foco), la pantalla se enciende como una
 * pantalla vieja: una segunda capa cian, con el mismo texto en oscuro, aparece encima con un parpadeo. Todo lo
 * decorativo es `aria-hidden`; es un único enlace con nombre accesible "Modo: estado" (`label`).
 */
export function PokedexCard({ name, href, state, attempts, label }: ModeCardProps) {
  const { leaveTo } = useSkin();
  const status =
    state === 'unknown'
      ? ''
      : state === 'pending'
        ? es.pokemonSkin.pokedexPending
        : attempts !== undefined
          ? es.pokemonSkin.pokedexSolved(attempts)
          : es.pokemonSkin.pokedexSolvedToday;

  return (
    <Link className={styles.dex} href={href} aria-label={label} data-state={state} data-card="pokedex" onClick={(event) => leaveTo(event, href)}>
      <span className={styles.top} aria-hidden="true">
        <PixelArt art={inlineArt(POKEDEX_LENS)} className={styles.lens} />
        <span className={styles.lights}>
          {LIGHTS.map((color) => (
            <PixelArt key={color} art={inlineArt({ rows: POKEDEX_LIGHT_ROWS, colors: { K: 'frame', H: 'white', C: color } })} />
          ))}
        </span>
      </span>

      <span className={styles.screen}>
        <ScreenFace name={name} status={status} />
        {/* La pantalla encendida: la misma cara, sobre cian y con la tinta oscura. */}
        <span className={styles.glow} aria-hidden="true">
          <ScreenFace name={name} status={status} />
        </span>
      </span>

      <span className={styles.controls} aria-hidden="true">
        <PixelArt art={inlineArt(POKEDEX_DPAD)} />
        <span className={styles.buttons}>
          {BUTTONS.map((color) => (
            <PixelArt key={color} art={inlineArt({ rows: POKEDEX_BUTTON_ROWS, colors: { K: 'frame', G: color } })} />
          ))}
        </span>
        <span className={styles.speaker} />
      </span>

      <span className={styles.play} aria-hidden="true">
        {es.pokemonSkin.play}
      </span>
    </Link>
  );
}

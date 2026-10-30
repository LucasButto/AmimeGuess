'use client';

import Link from 'next/link';
import { useSkin } from '@/components/skin/context';
import { es } from '@/i18n/es';
import type { ModeCardProps, ModeIconProps, TitleMarkProps } from '../../types';
import { modeIcon } from './modes';
import styles from './Scroll.module.scss';

/** El ícono de un modo, en tinta (hereda el color del texto). */
function ModeGlyph({ slug, className }: { slug: string; className: string }) {
  const { d, filled } = modeIcon(slug);
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className={filled ? styles.glyphFill : styles.glyphLine} d={d} />
    </svg>
  );
}

/** El sello rojo (hanko) que se estampa sobre un modo resuelto hoy, con una tilde blanca. */
function Hanko({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect className={styles.hankoInk} x="3" y="3" width="34" height="34" rx="5" />
      <rect className={styles.hankoEdge} x="7" y="7" width="26" height="26" rx="3" />
      <path className={styles.hankoTick} d="M12 21 L18 27 L29 13" />
    </svg>
  );
}

/** El texto del estado de hoy (vacío mientras no se leyó el almacenamiento). */
function statusOf({ state, attempts }: Pick<ModeCardProps, 'state' | 'attempts'>) {
  if (state === 'unknown') return '';
  if (state === 'pending') return es.narutoSkin.pending;
  return attempts !== undefined ? es.narutoSkin.solved(attempts) : es.narutoSkin.solvedToday;
}

/**
 * Tarjeta del modo principal (el Clásico): un gran pergamino abierto de lado a lado, con un rodillo de madera en cada
 * extremo, el nombre a pincel, el estado de hoy y, resuelto, el sello rojo estampado. Un único enlace "Modo: estado".
 */
function OpenScroll({ slug, name, href, state, attempts, label }: ModeCardProps) {
  const { leaveTo } = useSkin();
  return (
    <Link className={styles.open} href={href} aria-label={label} data-state={state} data-card="open-scroll" onClick={(event) => leaveTo(event, href)}>
      <span className={styles.roller} data-side="start" aria-hidden="true" />
      <span className={styles.sheet}>
        <ModeGlyph slug={slug} className={styles.openGlyph} />
        <span className={styles.openText}>
          <span className={styles.openName}>{name}</span>
          <span className={styles.status}>{statusOf({ state, attempts })}</span>
        </span>
        {state === 'solved' && <Hanko className={styles.openHanko} />}
      </span>
      <span className={styles.roller} data-side="end" aria-hidden="true" />
    </Link>
  );
}

/**
 * Tarjeta de Conexiones: un tablón de misiones de madera con cuatro papelitos clavados y el nombre en una tira de papel.
 * Con el hover y el foco los papelitos se mecen un poco.
 */
function MissionBoard({ name, href, state, label }: ModeCardProps) {
  const { leaveTo } = useSkin();
  return (
    <Link className={styles.board} href={href} aria-label={label} data-state={state} data-card="board" onClick={(event) => leaveTo(event, href)}>
      <span className={styles.notes} aria-hidden="true">
        {[0, 1, 2, 3].map((note) => (
          <span key={note} className={styles.note} data-note={note}>
            <span className={styles.pin} />
          </span>
        ))}
      </span>
      <span className={styles.tag}>{name}</span>
      {state === 'solved' && <Hanko className={styles.hanko} />}
    </Link>
  );
}

/**
 * Tarjeta de un modo que no es el principal: un pergamino enrollado (un rollo de papel con sus topes de madera) con el
 * nombre en una etiqueta de papel. Con el hover y el foco el papel se despliega un poco hacia abajo y deja ver el ícono
 * del modo. Resuelto hoy, lleva el sello rojo estampado.
 */
function RolledScroll({ slug, name, href, state, label }: ModeCardProps) {
  const { leaveTo } = useSkin();
  return (
    <Link className={styles.rolled} href={href} aria-label={label} data-state={state} data-card="scroll" onClick={(event) => leaveTo(event, href)}>
      <span className={styles.roll}>
        <span className={styles.cap} data-side="start" aria-hidden="true" />
        <span className={styles.tag}>{name}</span>
        <span className={styles.cap} data-side="end" aria-hidden="true" />
      </span>
      <span className={styles.flap} aria-hidden="true">
        {/* La punta del papel, cortada en V, con su contorno de tinta. */}
        <svg className={styles.flapPaper} viewBox="0 0 100 48" preserveAspectRatio="none" focusable="false">
          <path d="M1 0 V34 L50 47 L99 34 V0" />
        </svg>
        <ModeGlyph slug={slug} className={styles.glyph} />
      </span>
      {state === 'solved' && <Hanko className={styles.hanko} />}
    </Link>
  );
}

/** Slot `ModeCard` de Naruto: el Clásico es el pergamino abierto; Conexiones, el tablón de misiones; el resto, rollos. */
export function NarutoModeCard(props: ModeCardProps) {
  if (props.slug === 'clasico') return <OpenScroll {...props} />;
  if (props.slug === 'conexiones') return <MissionBoard {...props} />;
  return <RolledScroll {...props} />;
}

/** Slot `ModeIcon`: el ícono de tinta del modo en la navegación entre modos; resuelto, con un puntito rojo de sello. */
export function NarutoModeIcon({ slug, solved }: ModeIconProps) {
  return (
    <span className={styles.mini} aria-hidden="true" data-solved={solved}>
      <ModeGlyph slug={slug} className={styles.miniGlyph} />
    </span>
  );
}

/** Slot `TitleMark`: el ícono del modo antes del título, del tamaño de las letras. Decorativo. */
export function NarutoTitleMark({ slug }: TitleMarkProps) {
  return <ModeGlyph slug={slug} className={styles.titleMark} />;
}

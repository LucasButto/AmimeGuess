'use client';

import Link from 'next/link';
import { useId } from 'react';
import { useSkin } from '@/components/skin/context';
import { es } from '@/i18n/es';
import type { ModeCardProps, ModeIconProps, TitleMarkProps } from '../../types';
import { DragonBall } from './DragonBall';
import styles from './ModeCard.module.scss';
import { starsOf } from './modes';

// El contorno del hombro y el cuello (en una grilla de 140 × 150 unidades): el cuerpo termina en x = 0.
const TIP_FILL = 'M0 0 H20 C42 0 52 36 62 48 H92 V102 H62 C52 114 42 150 20 150 H0 Z';
const TIP_LINE = 'M0 0 H20 C42 0 52 36 62 48 H92 M0 150 H20 C42 150 52 114 62 102 H92';

/**
 * El extremo de la cápsula, dibujado a la derecha del cuerpo: el hombro que se angosta, el cuello corto con el accionador
 * (la pieza vertical que se aprieta para abrirla) en el medio y, al final, la tapa plana. Tiene su propia proporción: lo
 * único que se estira con el ancho de la tarjeta es el cuerpo.
 */
function CapsuleTip() {
  const shade = useId();
  const dots = useId();
  return (
    <svg className={styles.tip} viewBox="0 0 140 150" aria-hidden="true" focusable="false">
      <defs>
        {/* El mismo sombreado que el cuerpo, de arriba a abajo: luz arriba y sombra abajo. */}
        <linearGradient id={shade} x1="0" y1="0" x2="0" y2="1">
          <stop className={styles.bodyTop} offset="0" />
          <stop className={styles.bodyHigh} offset="0.2" />
          <stop className={styles.bodyMid} offset="0.55" />
          <stop className={styles.bodyLow} offset="1" />
        </linearGradient>
        {/* La textura de puntitos del cuerpo, para que no se corte donde empieza el hombro. */}
        <pattern id={dots} width="4.5" height="4.5" patternUnits="userSpaceOnUse">
          <circle className={styles.dot} cx="2.25" cy="2.25" r="0.45" />
        </pattern>
      </defs>
      <path fill={`url(#${shade})`} d={TIP_FILL} />
      <path fill={`url(#${dots})`} d={TIP_FILL} />
      <path className={styles.line} d={TIP_LINE} />
      {/* El accionador: una pieza vertical gris, más alta que el cuello, con un espacio libre a cada lado. */}
      <rect className={styles.actuator} x="70" y="34" width="10" height="82" rx="3" />
      <rect className={styles.cap} x="92" y="24" width="40" height="102" rx="6" />
      <rect className={styles.capShade} x="97" y="31" width="6" height="88" rx="3" />
    </svg>
  );
}

/**
 * Tarjeta del modo principal (el Clásico): una cápsula Hoi-Poi acostada, con el cuerpo blanco de punta redonda, una banda
 * azul de lado a lado con una etiqueta (el número del modo, su nombre y su estado de hoy) y, a la derecha, el hombro, el
 * cuello con el accionador y la tapa plana. Es un único enlace; su nombre accesible es "Modo: estado" (`label`).
 */
function CapsuleCard({ name, href, state, attempts, label, index }: ModeCardProps) {
  const { leaveTo } = useSkin();
  const status =
    state === 'unknown'
      ? ''
      : state === 'pending'
        ? es.dragonBallSkin.capsulePending
        : attempts !== undefined
          ? es.dragonBallSkin.capsuleSolved(attempts)
          : es.dragonBallSkin.capsuleSolvedToday;

  return (
    <Link className={styles.capsule} href={href} aria-label={label} data-state={state} data-card="capsule" onClick={(event) => leaveTo(event, href)}>
      <span className={styles.pill}>
        <span className={styles.band}>
          <span className={styles.label}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <span className={styles.text}>
              <span className={styles.capsuleName}>{name}</span>
              <span className={styles.capsuleStatus}>{status}</span>
            </span>
          </span>
        </span>
      </span>
      <CapsuleTip />
    </Link>
  );
}

/**
 * Tarjeta de un modo que no es el principal: una esfera del dragón con el nombre en una placa. Pendiente, la esfera se
 * ve apagada; resuelta hoy, brillante, con un resplandor dorado y un destello (sin tilde). Es un único enlace con nombre
 * accesible "Modo: estado".
 */
function SphereCard({ slug, name, href, state, label }: ModeCardProps) {
  const { leaveTo } = useSkin();
  const solved = state === 'solved';

  return (
    <Link className={styles.card} href={href} aria-label={label} data-state={state} data-card="sphere" onClick={(event) => leaveTo(event, href)}>
      <span className={styles.sphere} aria-hidden="true">
        <DragonBall stars={starsOf(slug)} dull={!solved} className={styles.ball} />
        {solved && <span className={styles.glint} />}
      </span>
      <span className={styles.name} data-tight={name.split(/\s+/).some((word) => word.length > 10) || undefined}>
        <span className={styles.nameText}>{name}</span>
      </span>
    </Link>
  );
}

/**
 * La nave Saiyajin (public/theme/dragon-ball/nave-saiyajin.webp), el ícono del Clásico dentro de un juego: ahí cada modo se
 * ve como una esfera y el principal, como esta nave. En la pantalla de inicio el Clásico sigue siendo la cápsula.
 */
function Pod({ className }: { className: string }) {
  return <img className={className} src="/theme/dragon-ball/nave-saiyajin.webp" alt="" width={256} height={256} />;
}

/** Slot `ModeCard` de Dragon Ball: el modo principal es una cápsula; los otros siete, las esferas del dragón. */
export function DragonModeCard(props: ModeCardProps) {
  return props.index === 0 ? <CapsuleCard {...props} /> : <SphereCard {...props} />;
}

/** Slot `ModeIcon`: miniaturas de 1,5 rem en la navegación entre modos (la nave Saiyajin del Clásico o la esfera del modo). */
export function DragonModeIcon({ slug, index, solved }: ModeIconProps) {
  if (index === 0) {
    return (
      <span className={styles.mini} aria-hidden="true">
        <Pod className={styles.miniBall} />
      </span>
    );
  }
  return (
    <span className={styles.mini} aria-hidden="true" data-solved={solved}>
      <DragonBall stars={starsOf(slug)} className={styles.miniBall} />
    </span>
  );
}

/**
 * Slot `TitleMark`: antes del título de la página de un modo, su esfera del dragón (con sus estrellas) o, en el Clásico, la
 * nave Saiyajin. Mide lo que las letras (en `em`), así sigue al título en cualquier tamaño. Decorativa.
 */
export function DragonTitleMark({ slug, index }: TitleMarkProps) {
  return index === 0 ? (
    <Pod className={`${styles.titleMark} ${styles.titleBall}`} />
  ) : (
    <DragonBall stars={starsOf(slug)} className={`${styles.titleMark} ${styles.titleBall}`} />
  );
}

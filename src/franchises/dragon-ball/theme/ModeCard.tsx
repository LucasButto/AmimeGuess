'use client';

import Link from 'next/link';
import { useSkin } from '@/components/skin/context';
import { es } from '@/i18n/es';
import type { ModeCardProps, ModeIconProps, TitleMarkProps } from '../../types';
import { DragonBall } from './DragonBall';
import styles from './ModeCard.module.scss';
/**
 * Las estrellas de la esfera de un modo que no es el principal: su lugar en la lista (el 0 es el Clásico, que no lleva
 * esfera). Así los modos van de 1 a 7 estrellas en orden, sean cuales sean los que estén prendidos: si Silueta se apaga,
 * Frase pasa a ser la de una estrella.
 */
function starsAt(index: number): number {
  return Math.min(7, Math.max(1, index));
}

/** Las siete posiciones visibles posteriores al Clásico usan esferas; las siguientes conservan el ícono adicional. */
function usesSphere(index: number): boolean {
  return index <= 7;
}

// El contorno del hombro y el cuello (en una grilla de 140 × 150 unidades): el cuerpo termina en x = 0.
/**
 * Tarjeta del modo principal (el Clásico): la imagen de una cápsula Hoi-Poi acostada con, sobre su recuadro celeste, una
 * etiqueta (el número del modo, su nombre y su estado de hoy). Es un único enlace; su nombre accesible es "Modo: estado"
 * (`label`).
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
      <img
        className={styles.capsuleArt}
        src="/img/dragon-ball/capsule/capsule-1024.webp"
        srcSet="/img/dragon-ball/capsule/capsule-512.webp 512w, /img/dragon-ball/capsule/capsule-1024.webp 1024w"
        sizes="(min-width: 64rem) 40rem, 90vw"
        width={1962}
        height={601}
        alt=""
        decoding="async"
        draggable={false}
      />
      <span className={styles.label}>
        <span className={styles.number} aria-hidden="true">
          {index + 1}
        </span>
        <span className={styles.text}>
          <span className={styles.capsuleName}>{name}</span>
          <span className={styles.capsuleStatus}>{status}</span>
        </span>
      </span>
    </Link>
  );
}

/**
 * Tarjeta de un modo que no es el principal: una esfera del dragón con el nombre en una placa. Pendiente, la esfera se
 * ve apagada; resuelta hoy, brillante, con un resplandor dorado y un destello (sin tilde). Es un único enlace con nombre
 * accesible "Modo: estado".
 */
function SphereCard({ name, href, state, label, index }: ModeCardProps) {
  const { leaveTo } = useSkin();
  const solved = state === 'solved';

  return (
    <Link className={styles.card} href={href} aria-label={label} data-state={state} data-card="sphere" onClick={(event) => leaveTo(event, href)}>
      <span className={styles.sphere} aria-hidden="true">
        {usesSphere(index) ? <DragonBall stars={starsAt(index)} dull={!solved} className={styles.ball} /> : <img src="/icons/dragon-ball/scouter.webp" alt="" width={200} height={200} className={styles.ball} />}
        {solved && <span className={styles.glint} />}
      </span>
      <span className={styles.name} data-tight={name.split(/\s+/).some((word) => word.length > 10) || undefined}>
        <span className={styles.nameText}>{name}</span>
      </span>
    </Link>
  );
}

/**
 * La cápsula azul (public/icons/dragon-ball/botella-azul.webp), el ícono del Clásico dentro de un juego: ahí cada modo se
 * ve como una esfera y el principal, como esta cápsula. En la pantalla de inicio el Clásico es la cápsula grande.
 */
function Capsule({ className }: { className: string }) {
  return <img className={className} src="/icons/dragon-ball/botella-azul.webp" alt="" width={200} height={200} draggable={false} />;
}

/** Slot `ModeCard` de Dragon Ball: el modo principal es una cápsula; los otros siete, las esferas del dragón. */
export function DragonModeCard(props: ModeCardProps) {
  return props.slug === 'clasico' ? <CapsuleCard {...props} /> : <SphereCard {...props} />;
}

/** Slot `ModeIcon`: miniaturas de 1,5 rem en la navegación entre modos (la cápsula del Clásico o la esfera del modo). */
export function DragonModeIcon({ slug, index, solved }: ModeIconProps) {
  if (slug === 'clasico') {
    return (
      <span className={styles.mini} aria-hidden="true">
        <Capsule className={styles.miniBall} />
      </span>
    );
  }
  return (
    <span className={styles.mini} aria-hidden="true" data-solved={solved}>
      {usesSphere(index) ? <DragonBall stars={starsAt(index)} className={styles.miniBall} /> : <img src="/icons/dragon-ball/scouter.webp" alt="" width={200} height={200} className={styles.miniBall} />}
    </span>
  );
}

/**
 * Slot `TitleMark`: antes del título de la página de un modo, su esfera del dragón (con sus estrellas) o, en el Clásico, la
 * cápsula azul. Mide lo que las letras (en `em`), así sigue al título en cualquier tamaño. Decorativa.
 */
export function DragonTitleMark({ slug, index }: TitleMarkProps) {
  return slug === 'clasico' ? (
    <Capsule className={`${styles.titleMark} ${styles.titleBall}`} />
  ) : (
    usesSphere(index) ? <DragonBall stars={starsAt(index)} className={`${styles.titleMark} ${styles.titleBall}`} /> : <img src="/icons/dragon-ball/scouter.webp" alt="" width={200} height={200} className={`${styles.titleMark} ${styles.titleBall}`} />
  );
}

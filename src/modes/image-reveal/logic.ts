// Lógica pura del motor `image-reveal`. Sin React y sin nada de ninguna
// franquicia: recibe la configuración, las entidades y los contenidos por
// parámetro. Todo lo que elige (la imagen del día, el punto del zoom) sale de
// `(franchise, mode, filterKey, day)` y del dataset: nunca de azar ni de un reloj.

import { seedFor, type DailyContext } from '@/engine/daily';
import { eligibleContents, eligibleEntities } from '@/engine/filters';
import { fmix32, fnv1a32 } from '@/engine/hash';
import { mulberry32 } from '@/engine/rng';
import type { Content, Entity } from '@/engine/types';
import type { ImageRevealConfig, RevealVariant } from './types';

// --- Candidatas e imágenes ----------------------------------------------------

/** Punto de la imagen, en fracciones del ancho y del alto (0 a 1). */
export interface Focus {
  readonly x: number;
  readonly y: number;
}

export interface RevealImage {
  readonly id: string;
  /** Ruta dentro de /public/img sin tamaño ni extensión, ver `ContentImage`. */
  readonly stem: string;
  /** Medidas del archivo más grande: solo definen la proporción. */
  readonly width: number;
  readonly height: number;
  /** Punto que el zoom abre primero, si el dato lo trae. */
  readonly focus: Focus | null;
}

/** Una posible respuesta del día, con las imágenes que sirven para mostrarla. */
export interface Candidate {
  /** El de la entidad: es lo que usa `pickDaily`. */
  readonly id: string;
  readonly entity: Entity;
  /** Ordenadas por id: el orden de los contenidos en el dataset no influye en la elegida. */
  readonly images: readonly RevealImage[];
}

/** Medidas de una imagen de entidad: el arte es cuadrado. */
const ENTITY_IMAGE_SIZE = 512;

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function unit(value: unknown): number | null {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : null;
}

function parseFocus(value: unknown): Focus | null {
  if (typeof value !== 'object' || value === null) return null;
  const x = unit((value as Record<string, unknown>).x);
  const y = unit((value as Record<string, unknown>).y);
  return x === null || y === null ? null : { x, y };
}

function imageOfContent(content: Content): RevealImage | null {
  const { image, width, height, focus } = content.payload;
  if (typeof image !== 'string' || image.length === 0) return null;
  return {
    id: content.id,
    stem: image,
    width: positiveInt(width) ?? ENTITY_IMAGE_SIZE,
    height: positiveInt(height) ?? ENTITY_IMAGE_SIZE,
    focus: parseFocus(focus),
  };
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Las respuestas posibles con las series activas: entidades elegibles (regla 1)
 * que tienen alguna imagen elegible (regla 2, para las que vienen de un
 * contenido). Una entidad sin imagen no puede ser la respuesta, pero sí un
 * intento: ver `eligibleEntities`.
 */
export function candidatesOf(
  entities: readonly Entity[],
  contents: readonly Content[],
  active: readonly string[],
  config: ImageRevealConfig,
): Candidate[] {
  const eligible = eligibleEntities(entities, active);

  if (config.imageContentKind === undefined) {
    return eligible.flatMap((entity) =>
      entity.image === undefined
        ? []
        : [
            {
              id: entity.id,
              entity,
              images: [{ id: entity.id, stem: entity.image, width: ENTITY_IMAGE_SIZE, height: ENTITY_IMAGE_SIZE, focus: null }],
            },
          ],
    );
  }

  const imagesByEntity = new Map<string, RevealImage[]>();
  for (const content of eligibleContents(contents, active)) {
    if (content.kind !== config.imageContentKind || content.entityId === undefined) continue;
    const image = imageOfContent(content);
    if (image === null) continue;
    const list = imagesByEntity.get(content.entityId);
    if (list) list.push(image);
    else imagesByEntity.set(content.entityId, [image]);
  }

  return eligible.flatMap((entity) => {
    const images = imagesByEntity.get(entity.id);
    return images === undefined ? [] : [{ id: entity.id, entity, images: images.sort(byId) }];
  });
}

/** La imagen del día de una respuesta que tiene varias: una elegida con un hash del día. */
export function pickImage(candidate: Candidate, ctx: DailyContext): RevealImage {
  const { images } = candidate;
  if (images.length === 1) return images[0];
  const hash = fmix32(fnv1a32(`${ctx.franchise}|${ctx.mode}|${ctx.filterKey}|${ctx.day}|${candidate.id}|image`));
  return images[hash % images.length];
}

// --- Qué se ve en cada paso ---------------------------------------------------

/** Pasos de revelado: el 0 es lo más oculto y el último, lo más claro sin llegar a mostrarla entera. */
export const REVEAL_STEPS = 6;

/**
 * El paso que corresponde a una cantidad de intentos fallidos. Con "revelar con
 * cada intento" apagado, la imagen se queda en el paso más oculto.
 */
export function revealStep(failed: number, reveal: boolean): number {
  return reveal ? Math.min(Math.max(failed, 0), REVEAL_STEPS - 1) : 0;
}

// Una entrada por paso, de lo más oculto a lo más claro.
const BLUR_REM = [1.7, 1.35, 1.05, 0.8, 0.6, 0.45] as const;
const BRIGHTNESS = [0, 0.06, 0.13, 0.22, 0.36, 0.55] as const;
const ZOOM_SCALE = [3.2, 2.6, 2.1, 1.7, 1.35, 1.15] as const;

/** Cómo se dibuja la imagen. El componente lo pasa a CSS como variables; los neutros no cambian nada. */
export interface RevealVisual {
  /** Radio del desenfoque, en rem. */
  readonly blur: number;
  /** 0 es negro (la sombra) y 1 es la imagen tal cual. */
  readonly brightness: number;
  /** 0 es a color y 1 es en grises. */
  readonly grayscale: number;
  /** Aumento del recorte. */
  readonly scale: number;
  /** Desplazamiento del recorte, en % del tamaño de la imagen (se aplica después de ampliar). */
  readonly x: number;
  readonly y: number;
}

/** La imagen entera, a color y nítida: lo que se ve al acertar. */
export const REVEALED: RevealVisual = { blur: 0, brightness: 1, grayscale: 0, scale: 1, x: 0, y: 0 };

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * La parte de la imagen que muestra un recorte ampliado `scale` veces centrado
 * en `focus`, como esquina superior izquierda en fracciones de la imagen. El
 * recorte nunca se sale de la imagen: cerca de un borde, se corre hacia adentro.
 */
export function zoomWindow(focus: Focus, scale: number): { x: number; y: number } {
  const size = 1 / scale;
  const corner = (center: number) => Math.min(Math.max(center - size / 2, 0), 1 - size);
  return { x: corner(focus.x), y: corner(focus.y) };
}

/** Lo que se ve en un paso. Sin "mostrar colores", todo lo que no es la imagen entera sale en grises. */
export function revealVisual(variant: RevealVariant, step: number, colors: boolean, focus: Focus): RevealVisual {
  const index = Math.min(Math.max(step, 0), REVEAL_STEPS - 1);
  const grayscale = colors ? 0 : 1;
  switch (variant) {
    case 'silhouette':
      return { ...REVEALED, brightness: BRIGHTNESS[index], grayscale };
    case 'blur':
      return { ...REVEALED, blur: BLUR_REM[index], grayscale };
    case 'zoom': {
      const scale = ZOOM_SCALE[index];
      const corner = zoomWindow(focus, scale);
      return { ...REVEALED, scale, x: round(-corner.x * 100), y: round(-corner.y * 100), grayscale };
    }
  }
}

// --- Punto del zoom -----------------------------------------------------------

// El punto sale de la franja central: el arte de una entidad tiene bordes vacíos y un recorte
// ahí no mostraría nada. Si el dato trae un punto focal, se usa ese en vez de este.
const FOCUS_MIN = 0.3;
const FOCUS_SPAN = 0.4;

/** Punto del zoom cuando el dato no trae uno: sale del PRNG del día, igual en todos los dispositivos. */
export function randomFocus(ctx: DailyContext): Focus {
  const rng = mulberry32(seedFor(ctx));
  return { x: round(FOCUS_MIN + rng() * FOCUS_SPAN), y: round(FOCUS_MIN + rng() * FOCUS_SPAN) };
}

// --- Intentos y resultado -----------------------------------------------------

/** Intentos que no fueron la respuesta: cada uno revela un paso más. */
export function failedCount(attemptIds: readonly string[], answerId: string): number {
  return attemptIds.filter((id) => id !== answerId).length;
}

/**
 * Los intentos guardados que siguen siendo válidos: sin repetidos y solo de
 * entidades que están entre las opciones actuales (el dataset pudo cambiar).
 */
export function restoreAttempts(stored: readonly unknown[] | undefined, options: readonly Pick<Entity, 'id'>[]): string[] {
  const valid = new Set(options.map((entity) => entity.id));
  const seen = new Set<string>();
  const restored: string[] = [];
  for (const id of stored ?? []) {
    if (typeof id === 'string' && valid.has(id) && !seen.has(id)) {
      seen.add(id);
      restored.push(id);
    }
  }
  return restored;
}

/**
 * Grilla para compartir: una línea por intento, en el orden en que se jugaron.
 * Solo rojo para el que falló y verde para el que acertó: no revela nada de la
 * respuesta.
 */
export function shareGrid(attemptIds: readonly string[], answerId: string): string[] {
  return attemptIds.map((id) => (id === answerId ? '🟩' : '🟥'));
}

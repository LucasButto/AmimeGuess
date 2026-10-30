'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  INITIAL_PLAYBACK, sameWalkerGeometry, advancePlayback, frameAt, appearanceSleep, chooseReplenishment, createWalkerBags, walkerPopulation, planWalker, hitsSprite,
  visibleDelta, walkerCapacity, walkerPose, withWalkerHeights, mirrorsSheet, chooseGroundLane, rollingGeometry, nextEntranceMs, WALKER_MAX,
  locomotionName, locomotionAnimation, burrowBounds, chooseBurrowPosition, advanceBurrow, playbackAnimation, wakeFromPointer,
  type WalkerDirection, type WalkerManifest, type WalkerPlan, type WalkerPlayback, type WalkerSheet, type WalkerViewport,
} from './walkerMotion';
import { getWalkerSpeed } from './walkerSpeed';
import { pokemonSpeedTestEnabled } from '@/franchises/visibility';
import { WalkerSpeedToggle } from './SpeedToggle';
import styles from './Walkers.module.scss';

interface DebugOptions { shiny?: boolean; direction?: WalkerDirection; hold?: boolean; sleep?: boolean }
// Survives route changes without adding game storage keys or resetting the draw history.
let walkerBags = createWalkerBags();
interface WalkerDebug {
  spawn: (pokemon: string | number, options?: DebugOptions) => Promise<boolean>;
  clear: () => void;
  resume: () => void;
}
declare global { interface Window { __pokemonWalkers?: WalkerDebug } }

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverReduced = () => true;
function subscribeReduced(change: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}
let cachedManifest: WalkerManifest | null = null;
async function loadManifest(signal: AbortSignal): Promise<WalkerManifest> {
  if (cachedManifest) return cachedManifest;
  const response = await fetch('/theme/pokemon/pmd/manifest.json', { signal });
  if (!response.ok) throw new Error('PMD manifest');
  const manifest: WalkerManifest = await response.json();
  if (manifest.version !== 1 || !manifest.pokemon?.length) throw new Error('PMD manifest format');
  const entities = await import('../../../../data/pokemon/entities.json');
  manifest.pokemon = withWalkerHeights(manifest.pokemon, entities.default);
  cachedManifest = manifest;
  return manifest;
}

interface Raster { image: HTMLImageElement; pixels: Uint8ClampedArray }
/** Only called for an appearance, or when that actor actually trips. No sheet prefetch list. */
async function loadSheet(sheet: WalkerSheet): Promise<Raster> {
  const image = new Image();
  image.decoding = 'async';
  image.src = sheet.url;
  await image.decode();
  if (image.naturalWidth !== sheet.width || image.naturalHeight !== sheet.height) throw new Error('PMD sheet dimensions');
  const canvas = document.createElement('canvas');
  canvas.width = sheet.width; canvas.height = sheet.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('PMD pixel hit-test');
  context.drawImage(image, 0, 0);
  return { image, pixels: context.getImageData(0, 0, sheet.width, sheet.height).data };
}

interface Actor {
  id: number; plan: WalkerPlan; playback: WalkerPlayback; pose: ReturnType<typeof walkerPose>;
  root: HTMLSpanElement; motion: HTMLSpanElement; facing: HTMLSpanElement; crop: HTMLSpanElement; image: HTMLImageElement;
  sheets: Map<string, Raster>; sheet: WalkerSheet; frame: number; armed: boolean; disposed: boolean;
  waitForTrip: boolean;
  mirrored: boolean; ageMs: number; sleepSchedule: ReturnType<typeof appearanceSleep>;
  shadowCrop?: HTMLSpanElement; shadowImage?: HTMLImageElement; shadowUrl?: string;
}

/** Imperative sprite surface: one RAF clock, no React renders for individual pixel-art frames. */
export function PokemonWalkers() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useSyncExternalStore(subscribeReduced, reduced, serverReduced);

  useEffect(() => {
    const layer = rootRef.current;
    if (!layer || reduce) return;
    const controller = new AbortController();
    const actors: Actor[] = [];
    const unit = document.createElement('span');
    unit.className = styles.unit;
    layer.append(unit);
    let alive = true, serial = 0, pending = false, debugMode = false, logicalTime = 0, epoch = 0;
    let last: number | null = null, raf = 0, nextSpawn = 0;
    let lastDirection: WalkerDirection | null = null;
    let manifest: WalkerManifest | null = null;
    let scanOcclusion = false, modalPaused = false;
    const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));
    const metric = (): WalkerViewport => ({
      width: window.innerWidth, height: window.innerHeight,
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      artPixel: unit.getBoundingClientRect().width,
      ground: layer.parentElement?.querySelector('[data-pmd-ground]')?.getBoundingClientRect().height ?? 160,
      occluders: Array.from(layer.parentElement?.parentElement?.querySelectorAll('a[data-card="pokedex"], a[data-card="ball"] > span, main > div:has(> p[aria-live]), footer') ?? []).map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      }),
      skyFloor: layer.parentElement?.querySelector('[data-pmd-trees]')?.getBoundingClientRect().top,
      occupiedLanes: actors.filter((actor) => actor.plan.pokemon.zone === 'ground').map((actor) => actor.plan.feetY),
    });
    let viewport = metric();
    const rem = (value: number) => `${value / viewport.rem}rem`;
    const remove = (actor: Actor) => {
      actor.disposed = true;
      actor.root.remove();
      actor.sheets.clear();
      const index = actors.indexOf(actor);
      if (index >= 0) actors.splice(index, 1);
    };
    const clear = () => { epoch++; lastDirection = null; for (const actor of [...actors]) remove(actor); };
    const refresh = () => {
      if (modalPaused || dialogOpen()) return;
      const next = metric();
      // Un modal puede quitar las barras de scroll sin cambiar la geometría de la escena.
      if (sameWalkerGeometry(viewport, next)) return;
      viewport = next;
      clear();
      nextSpawn = logicalTime;
    };
    const observer = new ResizeObserver(refresh);
    const ground = layer.parentElement?.querySelector('[data-pmd-ground]');
    if (ground) observer.observe(ground);
    window.addEventListener('resize', refresh);
    const scroll = () => {
      if (modalPaused || dialogOpen()) return;
      epoch++; scanOcclusion = true;
    };
    window.addEventListener('scroll', scroll, { passive: true });

    const render = (actor: Actor) => {
      const { plan, playback } = actor;
      const active = playbackAnimation(plan.pokemon, plan.variant, playback.phase);
      const animation = plan.variant.animations[active];
      const sheet = animation.directions[plan.direction];
      const mirror = mirrorsSheet(sheet, plan.direction, animation.directions.east);
      actor.mirrored = mirror;
      actor.facing.style.transform = `scaleX(${mirror ? -1 : 1})`;
      actor.root.dataset.mirrored = String(mirror);
      actor.root.dataset.sourceRows = String(sheet.sourceRows);
      actor.root.dataset.singleDirection = String(sheet.sourceRows === 1 || Boolean(animation.directions.east.sha256 && animation.directions.east.sha256 === animation.directions.west.sha256));
      if (actor.sheet.url !== sheet.url) {
        actor.sheet = sheet;
        actor.image.src = sheet.url;
        actor.image.width = sheet.width; actor.image.height = sheet.height;
        actor.image.style.width = rem(sheet.width); actor.image.style.height = rem(sheet.height);
        actor.crop.style.width = rem(sheet.frameWidth); actor.crop.style.height = rem(sheet.frameHeight);
        actor.crop.style.transform = `translate(${rem(-sheet.anchor.x)}, ${rem(-sheet.anchor.y)})`;
      }
      const elapsed = playback.phase === 'walk' || playback.phase === 'loading' ? actor.waitForTrip ? playback.phaseMs : playback.travelMs : playback.phaseMs;
      actor.frame = playback.phase === 'hold' ? sheet.frames.length - 1 : frameAt(sheet, elapsed, !['fall', 'lie', 'wake', 'emerge', 'hide'].includes(playback.phase));
      const frame = sheet.frames[actor.frame];
      actor.image.style.transform = `translate(${rem(-frame.x)}, ${rem(-frame.y)})`;
      if (actor.shadowImage && actor.shadowCrop) {
        const shadow = animation.shadow!.directions[plan.direction];
        if (actor.shadowUrl !== shadow.url) {
          actor.shadowUrl = shadow.url;
          actor.shadowImage.src = shadow.url;
          actor.shadowImage.width = shadow.width; actor.shadowImage.height = shadow.height;
          actor.shadowImage.style.width = rem(shadow.width); actor.shadowImage.style.height = rem(shadow.height);
          actor.shadowCrop.style.width = rem(shadow.frameWidth); actor.shadowCrop.style.height = rem(shadow.frameHeight);
          actor.shadowCrop.style.transform = `translate(${rem(-shadow.anchor.x)}, ${rem(-shadow.anchor.y)})`;
        }
        const shadowFrame = shadow.frames[actor.frame];
        actor.shadowImage.style.transform = `translate(${rem(-shadowFrame.x)}, ${rem(-shadowFrame.y)})`;
      }
      actor.pose = walkerPose(plan, playback.travelMs, viewport.rem);
      if (['lie', 'sleep', 'wake'].includes(playback.phase)) actor.pose = { ...actor.pose, y: Math.round(plan.y), angle: 0, opacity: 1 };
      if (plan.pokemon.movement === 'roll') {
        if (active === locomotionName(plan.pokemon)) {
          const geometry = rollingGeometry(sheet, plan.scale, mirror, actor.frame);
          actor.pose = { ...actor.pose, frameOffsetX: geometry.frameOffsetX, frameOffsetY: geometry.frameOffsetY };
          actor.crop.style.transform = `translate(${rem(-sheet.anchor.x + geometry.frameOffsetX)}, ${rem(-sheet.anchor.y + geometry.frameOffsetY)})`;
        } else {
          actor.pose = { ...actor.pose, y: Math.round(plan.y), angle: 0, pivotX: 0, pivotY: 0 };
          actor.crop.style.transform = `translate(${rem(-sheet.anchor.x)}, ${rem(-sheet.anchor.y)})`;
        }
        // Fixed during rolling; only the rotation and the sheet translations animate.
        actor.motion.style.transformOrigin = `${rem(actor.pose.pivotX ?? 0)} ${rem(actor.pose.pivotY ?? 0)}`;
      }
      actor.root.style.transform = `translate(${rem(actor.pose.x)}, ${rem(actor.pose.y)})`;
      actor.motion.style.transform = `rotate(${actor.pose.angle}deg)`;
      actor.motion.style.opacity = String(actor.pose.opacity * (playback.phase === 'recover' ? 0.35 + 0.65 * Math.min(1, playback.phaseMs / 180) : 1));
      actor.root.dataset.phase = playback.phase;
      actor.root.dataset.frame = String(actor.frame);
    };

    const spawn = async (pokemon: WalkerManifest['pokemon'][number], options: DebugOptions = {}, debug = false) => {
      if (!alive || reduced() || document.hidden || pending) return false;
      if (actors.some(actor => actor.plan.pokemon.entityId === pokemon.entityId)) return false;
      if (!debug && actors.length >= walkerCapacity(viewport.width, viewport.height, viewport.rem)) return false;
      pending = true;
      const appearanceEpoch = epoch;
      try {
        viewport = metric();
        let plan = planWalker(pokemon, viewport, Math.random, options);
        if (pokemon.burrow) {
          const position = chooseBurrowPosition(plan, viewport, Math.random, box => uncoveredBox(box, true));
          if (!position) return false;
          plan = position;
        }
        if (!plan.canAppear) return false;
        const initial = pokemon.burrow ? plan.variant.animations[pokemon.burrow.emerge] : locomotionAnimation(pokemon, plan.variant);
        const sheet = initial.directions[plan.direction];
        const raster = await loadSheet(sheet);
        const sheets = new Map([[sheet.url, raster]]);
        if (pokemon.burrow) {
          for (const name of Object.values(pokemon.burrow)) {
            const animation = plan.variant.animations[name];
            for (const needed of [animation.directions[plan.direction], animation.shadow!.directions[plan.direction]]) {
              if (!sheets.has(needed.url)) sheets.set(needed.url, await loadSheet(needed));
            }
          }
          if (!uncoveredBox(burrowBounds(plan, viewport.rem), true)) return false;
        }
        if (!alive || reduced() || document.hidden || dialogOpen() || appearanceEpoch !== epoch) return false;
        if (debug) while (actors.length >= WALKER_MAX) remove(actors[0]);
        const root = document.createElement('span'), motion = document.createElement('span');
        const scale = document.createElement('span'), facing = document.createElement('span'), crop = document.createElement('span'), target = document.createElement('span');
        const image = document.createElement('img');
        image.src = sheet.url; image.decoding = 'async';
        image.width = sheet.width; image.height = sheet.height;
        root.className = styles.actor; motion.className = styles.motion; scale.className = styles.scale;
        facing.className = styles.facing;
        crop.className = styles.crop; crop.dataset.pmdFrame = ''; target.className = styles.target; image.className = styles.sheet;
        root.dataset.pmdWalker = pokemon.entityId;
        root.dataset.walkerId = String(++serial);
        root.dataset.zone = pokemon.zone; root.dataset.movement = pokemon.movement;
        root.dataset.shiny = String(plan.shiny); root.dataset.direction = plan.direction; root.dataset.scale = String(plan.scale);
        root.dataset.lane = String(plan.lane); root.dataset.feetY = String(plan.feetY); root.dataset.visibleHeight = String(plan.visibleHeight);
        root.dataset.heightMeters = String(pokemon.heightMeters ?? 'bbox');
        root.style.zIndex = String(plan.depth);
        root.dataset.canTrip = String(!pokemon.burrow && pokemon.zone === 'ground' && plan.variant.hasHitGround);
        root.dataset.locomotion = locomotionName(pokemon);
        root.dataset.burrow = String(Boolean(pokemon.burrow));
        root.setAttribute('aria-hidden', 'true'); image.alt = ''; image.draggable = false;
        scale.style.transform = `scale(${plan.scale})`;
        crop.style.width = rem(sheet.frameWidth); crop.style.height = rem(sheet.frameHeight);
        crop.style.transform = `translate(${rem(-sheet.anchor.x)}, ${rem(-sheet.anchor.y)})`;
        image.style.width = rem(sheet.width); image.style.height = rem(sheet.height);
        crop.append(image, target); facing.append(crop); scale.append(facing); motion.append(scale); root.append(motion);
        if (plan.shiny) {
          // Destellos de variocolor: tres estrellitas sobre la cabeza que acompañan al sprite.
          const top = (sheet.bbox.y - sheet.anchor.y) * plan.scale, centerX = (sheet.bbox.x + sheet.bbox.width / 2 - sheet.anchor.x) * plan.scale;
          const spread = Math.max(viewport.rem * 1.5, sheet.bbox.width * plan.scale * 0.35);
          [[-spread, -0.4, 0], [spread * 0.8, -1, 1], [0, -1.8, 2]].forEach(([dx, dy, index]) => {
            const star = document.createElement('span');
            star.className = styles.sparkle;
            star.dataset.pmdSparkle = '';
            star.style.setProperty('--sparkle-delay', `${index * 0.45}s`);
            star.style.transform = `translate(${rem(centerX + dx)}, ${rem(top + dy * viewport.rem)})`;
            motion.append(star);
          });
        }
        const playback: WalkerPlayback = { ...INITIAL_PLAYBACK, phase: pokemon.burrow ? 'emerge' : 'walk' };
        const actor: Actor = { id: serial, plan, playback, pose: walkerPose(plan, playback.travelMs, viewport.rem),
          root, motion, facing, crop, image, sheet, sheets, frame: 0, armed: true, disposed: false, waitForTrip: Boolean(!pokemon.burrow && debug && options.hold), mirrored: false, ageMs: 0,
          sleepSchedule: pokemon.burrow || pokemon.zone === 'sky' ? null : options.sleep && plan.variant.sleep ? { atMs: 0, durationMs: 12000 } : appearanceSleep(plan.variant, pokemon.zone, Math.random) };
        if (pokemon.burrow) {
          const shadowCrop = document.createElement('span'), shadowImage = document.createElement('img');
          shadowCrop.className = styles.crop; shadowCrop.dataset.pmdShadow = '';
          shadowImage.className = styles.sheet; shadowImage.alt = ''; shadowImage.decoding = 'async'; shadowImage.draggable = false;
          shadowCrop.append(shadowImage); facing.prepend(shadowCrop);
          actor.shadowCrop = shadowCrop; actor.shadowImage = shadowImage;
        }
        root.dataset.canSleep = String(Boolean(!pokemon.burrow && plan.variant.sleep && pokemon.zone === 'ground'));
        const trip = async (event: PointerEvent) => {
          if (!alive || actor.disposed || document.hidden || reduced() || !actor.armed || actor.playback.phase !== 'walk' || root.dataset.canTrip !== 'true') return;
          // Native modal dialogs make the background inert, including exposed margins.
          if (document.querySelector('dialog[open]')) return;
          if (event.type !== 'pointerdown' && (!window.matchMedia('(hover: hover)').matches || event.pointerType === 'touch')) return;
          if (event.type === 'pointerdown' && event.pointerType === 'mouse') return;
          if (document.elementFromPoint(event.clientX, event.clientY) !== target) return;
          const pixels = actor.sheets.get(actor.sheet.url)?.pixels;
          if (!pixels || !hitsSprite({ x: event.clientX, y: event.clientY }, actor.pose, plan.scale, actor.sheet, actor.frame, pixels, actor.mirrored)) return;
          actor.armed = false;
          actor.waitForTrip = false;
          actor.playback = { ...actor.playback, phase: 'loading', phaseMs: 0 };
          render(actor);
          try {
            for (const name of ['HitGround', 'Idle']) {
              const needed = plan.variant.animations[name].directions[plan.direction];
              if (!actor.sheets.has(needed.url)) {
                const loaded = await loadSheet(needed);
                if (!alive || actor.disposed) return;
                actor.sheets.set(needed.url, loaded);
              }
            }
            actor.playback = { ...actor.playback, phase: 'fall', phaseMs: 0 };
            if (!document.hidden) render(actor);
          } catch {
            if (!actor.disposed) actor.playback = { ...actor.playback, phase: 'walk', phaseMs: 0 };
          }
        };
        const wake = (event: PointerEvent) => {
          if (!alive || actor.disposed || reduced() || !['lie', 'sleep'].includes(actor.playback.phase)) return;
          const pixels = actor.sheets.get(actor.sheet.url)?.pixels;
          if (!pixels) return;
          const next = wakeFromPointer(actor.playback, {
            hidden: document.hidden, dialogOpen: Boolean(document.querySelector('dialog[open]')),
            uncovered: document.elementFromPoint(event.clientX, event.clientY) === target,
            pointerType: event.pointerType, button: event.button, point: { x: event.clientX, y: event.clientY },
            pose: actor.pose, scale: plan.scale, sheet: actor.sheet, frame: actor.frame, pixels, mirrored: actor.mirrored,
          });
          if (next !== actor.playback) { actor.playback = next; render(actor); }
        };
        target.addEventListener('pointerdown', wake);
        target.addEventListener('pointerenter', trip);
        target.addEventListener('pointermove', trip);
        target.addEventListener('pointerdown', trip);
        target.addEventListener('pointerleave', () => { if (actor.playback.phase === 'walk') actor.armed = true; });
        actors.push(actor); render(actor); layer.append(root);
        if (!pokemon.burrow) lastDirection = plan.direction;
        nextSpawn = nextEntranceMs(logicalTime, Math.random);
        return true;
      } catch { return false; } finally { pending = false; }
    };

    const uncoveredBox = (box: { x: number; y: number; width: number; height: number }, strict = false) => {
      if (document.querySelector('dialog[open]')) return false;
      if (strict && (box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height)) return false;
      if (strict && viewport.occluders?.some(rect => box.x < rect.x + rect.width && box.x + box.width > rect.x && box.y < rect.y + rect.height && box.y + box.height > rect.y)) return false;
      const xs = strict ? [0.05, 0.25, 0.5, 0.75, 0.95] : [0.2, 0.5, 0.8];
      const ys = strict ? [0.05, 0.35, 0.65, 0.95] : [0.25, 0.65];
      const points = xs.flatMap(x => ys.map(y => document.elementFromPoint(box.x + box.width * x, box.y + box.height * y)));
      return points.every(element => element !== null && !element.closest('main, footer, dialog'));
    };
    const exposed = (actor: Actor) => {
      const box = actor.crop.getBoundingClientRect();
      const bounds = actor.sheet.frames[actor.frame].bbox ?? actor.sheet.bbox;
      const left = box.left + (actor.mirrored ? actor.sheet.frameWidth - bounds.x - bounds.width : bounds.x) * actor.plan.scale;
      const top = box.top + bounds.y * actor.plan.scale;
      return uncoveredBox({ x: left, y: top, width: bounds.width * actor.plan.scale, height: bounds.height * actor.plan.scale });
    };
    const sleep = async (actor: Actor) => {
      const recipe = actor.plan.variant.sleep, schedule = actor.sleepSchedule;
      if (!recipe || !schedule) return;
      if (!exposed(actor)) { schedule.atMs = actor.ageMs + 1000; return; }
      actor.sleepSchedule = null;
      actor.playback = { ...actor.playback, phase: 'loading', phaseMs: 0 };
      try {
        for (const name of new Set([recipe.enter, recipe.sleep, recipe.wake])) {
          if (!name) continue;
          const sheet = actor.plan.variant.animations[name].directions[actor.plan.direction];
          if (!actor.sheets.has(sheet.url)) actor.sheets.set(sheet.url, await loadSheet(sheet));
          if (!alive || actor.disposed) return;
        }
        actor.root.dataset.sleepDuration = String(schedule.durationMs);
        actor.playback = { ...actor.playback, phase: exposed(actor) ? recipe.enter ? 'lie' : 'sleep' : 'walk', phaseMs: 0 };
      } catch { if (!actor.disposed) actor.playback = { ...actor.playback, phase: 'walk', phaseMs: 0 }; }
    };

    const tick = (now: number) => {
      if (!alive || document.hidden || reduced()) return;
      if (dialogOpen()) {
        modalPaused = true;
        layer.dataset.paused = 'true';
        // No avanza ningún reloj: se conservan actores, posiciones, cuadros y próximas apariciones.
        last = null;
        scanOcclusion = false;
        raf = requestAnimationFrame(tick);
        return;
      }
      if (modalPaused) {
        modalPaused = false;
        layer.dataset.paused = 'false';
        last = null;
        scanOcclusion = false;
        // Solo una redimensión real durante la pausa necesita reconstruir el paisaje.
        refresh();
      }
      const raw = visibleDelta(last, now, false);
      const clock = { ...raw, delta: raw.delta * (pokemonSpeedTestEnabled ? getWalkerSpeed() : 1) };
      last = clock.last; logicalTime += clock.delta;
      if (scanOcclusion && !document.querySelector('dialog[open]')) {
        scanOcclusion = false; viewport = metric();
        for (const actor of [...actors]) if (actor.plan.pokemon.zone === 'ground'
          && (actor.plan.pokemon.burrow ? !uncoveredBox(burrowBounds(actor.plan, viewport.rem), true) : !chooseGroundLane(actor.plan.feetY, actor.plan.feetY, actor.plan.visibleHeight, { ...viewport, occupiedLanes: [] }, () => 0).available)) {
          remove(actor);
        }
      }
      const population = walkerPopulation(viewport.width, viewport.height, viewport.rem);
      for (const actor of [...actors]) {
        actor.ageMs += clock.delta;
        const animations = actor.plan.variant.animations;
        const recipe = actor.plan.variant.sleep;
        const heldPosition = actor.playback.travelMs;
        actor.playback = actor.plan.pokemon.burrow ? advanceBurrow(actor.playback, clock.delta, {
          emerge: animations[actor.plan.pokemon.burrow.emerge].directions[actor.plan.direction].totalDurationMs,
          idle: actor.plan.burrowIdleMs!, hide: animations[actor.plan.pokemon.burrow.hide].directions[actor.plan.direction].totalDurationMs,
        }) : advancePlayback(actor.playback, clock.delta,
          animations.HitGround?.directions[actor.plan.direction].totalDurationMs ?? 0,
          animations.Idle?.directions[actor.plan.direction].totalDurationMs ?? 0, recipe ? { lieMs: recipe.enter ? animations[recipe.enter].directions[actor.plan.direction].totalDurationMs : 0, sleepMs: Number(actor.root.dataset.sleepDuration ?? 12000), wakeMs: animations[recipe.wake].directions[actor.plan.direction].totalDurationMs } : undefined);
        if (actor.waitForTrip && actor.playback.phase === 'walk') {
          const box = actor.crop.getBoundingClientRect();
          if (box.left >= 2 * viewport.rem && box.right <= viewport.width - 2 * viewport.rem) actor.playback.travelMs = heldPosition;
        }
        const walk = locomotionAnimation(actor.plan.pokemon, actor.plan.variant).directions[actor.plan.direction];
        const x = walkerPose(actor.plan, actor.playback.travelMs, viewport.rem).x;
        const left = x + (walk.bbox.x - walk.anchor.x) * actor.plan.scale;
        const right = left + walk.bbox.width * actor.plan.scale;
        const outside = !actor.plan.pokemon.burrow && (actor.plan.direction === 'east' ? left >= viewport.width : right <= 0);
        if (actor.playback.phase === 'done' || outside || actor.playback.travelMs >= actor.plan.durationMs) remove(actor);
        else {
          render(actor);
          if (actor.sleepSchedule && actor.ageMs >= actor.sleepSchedule.atMs && actor.playback.phase === 'walk'
            && (debugMode || actors.filter((entry) => entry.plan.pokemon.zone === 'ground' && entry.playback.phase === 'walk').length > Math.min(population.ground.min, population.ground.max - 1))) void sleep(actor);
        }
      }
      if (manifest && !debugMode && logicalTime >= nextSpawn) {
        if (!pending && actors.length < WALKER_MAX) {
          const previous = (['east', 'west'] as const).flatMap(direction => {
            const last = actors.findLast(actor => !actor.plan.pokemon.burrow && actor.plan.direction === direction);
            return last ? [{ direction, left: last.crop.getBoundingClientRect().left, right: last.crop.getBoundingClientRect().right }] : [];
          });
          const choice = chooseReplenishment({
            bags: walkerBags,
            pokemon: manifest.pokemon,
            actors: actors.map(actor => ({ zone: actor.plan.pokemon.zone, walking: actor.playback.phase === 'walk' || Boolean(actor.plan.pokemon.burrow && actor.playback.phase !== 'done') })),
            population, now: logicalTime, nextAt: nextSpawn, pending, lastDirection, previous,
            activeIds: actors.map(actor => actor.plan.pokemon.entityId),
            width: viewport.width, rem: viewport.rem,
          }, Math.random);
          if (choice) {
            walkerBags = choice.bags;
            void spawn(choice.pokemon, { direction: choice.direction }).then(shown => {
              if (!shown && alive) nextSpawn = Math.max(nextSpawn, logicalTime + 250);
            });
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(raf); last = null;
      layer.dataset.paused = String(document.hidden || dialogOpen());
      if (!document.hidden && alive) raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', visibility);
    void loadManifest(controller.signal).then((result) => {
      if (!alive) return;
      manifest = result; layer.dataset.pmdReady = 'true';
      if (process.env.NODE_ENV === 'development') window.__pokemonWalkers = {
        spawn: async (key, options = {}) => {
          const text = String(key).toLowerCase();
          const pokemon = result.pokemon.find((entry) => [entry.entityId, entry.name.toLowerCase(), entry.dex, String(entry.number)].includes(text));
          if (!pokemon) return false;
          debugMode = true;
          while (pending && alive && !reduced() && !document.hidden) await new Promise((resolve) => setTimeout(resolve, 25));
          return spawn(pokemon, options, true);
        },
        clear: () => { debugMode = true; clear(); },
        resume: () => { debugMode = false; for (const actor of actors) actor.waitForTrip = false; nextSpawn = logicalTime + 1000; },
      };
      visibility();
    }).catch(() => { if (alive) layer.dataset.pmdReady = 'error'; });
    return () => {
      alive = false; controller.abort(); cancelAnimationFrame(raf); clear(); observer.disconnect(); unit.remove();
      window.removeEventListener('resize', refresh); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('scroll', scroll);
      if (process.env.NODE_ENV === 'development') delete window.__pokemonWalkers;
    };
  }, [reduce]);

  return reduce ? null : (
    <>
      <div ref={rootRef} className={styles.layer} data-pmd-walkers="" aria-hidden="true" />
      {pokemonSpeedTestEnabled && <WalkerSpeedToggle />}
    </>
  );
}

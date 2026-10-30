/** Presentation only: no daily RNG, game state or storage. Physical size takes priority over integer zoom. */
export type WalkerDirection = 'east' | 'west';
export type WalkerMovement = 'walk' | 'run' | 'burrow' | 'roll' | 'stagger' | 'zigzag' | 'drift' | 'hop' | 'hover';
export interface WalkerBox { x: number; y: number; width: number; height: number }
export interface WalkerSheet {
  referenceBbox?: WalkerBox;
  url: string; width: number; height: number; frameWidth: number; frameHeight: number;
  anchor: { x: number; y: number }; bbox: WalkerBox; totalDurationMs: number;
  sourceRows: number; sourceRow: number;
  sha256?: string;
  frames: { x: number; y: number; durationMs: number; bbox: WalkerBox | null }[];
}
export interface WalkerVariant {
  hasHitGround: boolean;
  sleep?: { enter: string | null; sleep: string; wake: string } | null;
  animations: Record<string, { directions: Record<WalkerDirection, WalkerSheet>; shadow?: { directions: Record<WalkerDirection, WalkerSheet> } }>;
}
export interface WalkerPokemon {
  formHeightMeters?: number;
  sizeFactor?: number;
  elongated?: boolean;
  entityId: string; name: string; number: number; dex: string; form: string;
  zone: 'ground' | 'sky'; movement: WalkerMovement;
  locomotion?: string;
  /** Subida y bajada en pasos mientras avanza (un cuadro arriba, otro abajo). */
  locomotionBob?: { ms: number; px: number };
  burrow?: { emerge: string; idle: string; hide: string };
  heightMeters?: number;
  variants: { normal: WalkerVariant; shiny: WalkerVariant | null };
}
export interface WalkerManifest { version: number; pokemon: WalkerPokemon[] }
export interface WalkerViewport {
  width: number; height: number; rem: number; artPixel: number; ground: number;
  occluders?: readonly WalkerBox[]; occupiedLanes?: readonly number[];
  /** Y de la copa más alta de los árboles: los voladores nunca bajan de ahí. */
  skyFloor?: number;
}
/** Las barras de scroll y las oclusiones no cambian la geometría del reloj de la escena. */
export function sameWalkerGeometry(a: WalkerViewport, b: WalkerViewport): boolean {
  return a.width === b.width && a.height === b.height && a.rem === b.rem
    && a.artPixel === b.artPixel && a.ground === b.ground;
}

export interface WalkerPlan {
  pokemon: WalkerPokemon; variant: WalkerVariant; shiny: boolean; direction: WalkerDirection;
  scale: number; speed: number; start: number; end: number; y: number; durationMs: number;
  feetY: number; depth: number; lane: number; visibleHeight: number; canAppear: boolean;
  burrowIdleMs?: number;
}
export interface WalkerPlayback {
  phase: 'walk' | 'loading' | 'fall' | 'hold' | 'recover' | 'lie' | 'sleep' | 'wake' | 'emerge' | 'burrow-idle' | 'hide' | 'done'; phaseMs: number; travelMs: number;
}
export const INITIAL_PLAYBACK: WalkerPlayback = { phase: 'walk', phaseMs: 0, travelMs: 0 };
export const HOLD_MS = 700;
export const SHINY_ODDS = 512;
export const WALKER_MAX = 6;
export const nextEntranceMs = (now: number, random: () => number) => now + 1500 + Math.max(0, Math.min(1, random())) * 1000;

/** Prefer the opposite side; a blocked entrance never bypasses the logical-clock delay. */
export function entranceDirection(now: number, nextAt: number, preferred: WalkerDirection, previous: readonly { direction: WalkerDirection; left: number; right: number }[], width: number, rem: number): WalkerDirection | null {
  if (now < nextAt) return null;
  for (const direction of [preferred, preferred === 'east' ? 'west' : 'east'] as const) {
    const last = previous.find((entry) => entry.direction === direction);
    if (!last || (direction === 'east' ? last.left >= 2 * rem : last.right <= width - 2 * rem)) return direction;
  }
  return null;
}

export const compactWalkers = (width: number, height: number, rem: number) => width < 768 || height <= 26 * rem;
export function walkerPopulation(width: number, height: number, rem: number) {
  const compact = compactWalkers(width, height, rem);
  // Reserve a seven-rem footprint plus one crossing space for a large creature.
  const groundMin = compact ? Math.max(1, Math.min(3, Math.floor(width / (7 * rem)) - 1)) : 3;
  return { ground: { min: groundMin, max: compact ? Math.min(4, groundMin + 2) : 4 }, sky: { min: 1, max: 2 } };
}
export function walkerCapacity(width: number, height: number, rem: number): number {
  const target = walkerPopulation(width, height, rem);
  return Math.min(WALKER_MAX, target.ground.max + target.sky.max);
}
export function replenishmentZone(actors: readonly { zone: 'ground' | 'sky'; walking: boolean }[], population: ReturnType<typeof walkerPopulation>): 'ground' | 'sky' | null {
  if (actors.length >= WALKER_MAX) return null;
  for (const buffer of [0, 1]) for (const zone of ['sky', 'ground'] as const) {
    const count = actors.filter((actor) => actor.zone === zone);
    if (count.length < population[zone].max && count.filter((actor) => actor.walking).length < population[zone].min + buffer) return zone;
  }
  return null;
}

/** No species draw until cadence, capacity and a shared entrance are all available. */
export interface WalkerBag { key: string; remaining: readonly string[]; cycle: number }
export type WalkerBags = Record<'ground' | 'sky', WalkerBag>;
export const createWalkerBags = (): WalkerBags => ({ ground: { key: '', remaining: [], cycle: 0 }, sky: { key: '', remaining: [], cycle: 0 } });

/** Pure shuffle-bag draw: active IDs stay in the current cycle, never force a premature refill. */
export function drawWalkerBag(bag: WalkerBag, pool: readonly string[], active: ReadonlySet<string>, random: () => number): { id: string; bag: WalkerBag } | null {
  if (!pool.some(id => !active.has(id))) return null;
  const key = [...pool].sort().join('\0');
  let remaining = bag.key === key ? [...bag.remaining] : [];
  let cycle = bag.key === key ? bag.cycle : 0;
  if (!remaining.length) {
    remaining = [...pool]; cycle++;
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
  }
  const index = remaining.findIndex(id => !active.has(id));
  if (index < 0) return null;
  const [id] = remaining.splice(index, 1);
  return { id, bag: { key, remaining, cycle } };
}

export function chooseReplenishment(request: {
  bags: WalkerBags;
  pokemon: readonly WalkerPokemon[];
  actors: readonly { zone: 'ground' | 'sky'; walking: boolean }[];
  population: ReturnType<typeof walkerPopulation>;
  now: number; nextAt: number; pending: boolean; lastDirection: WalkerDirection | null;
  /** Pokémon ya en escena: dos iguales nunca conviven. */
  activeIds?: readonly string[];
  previous: readonly { direction: WalkerDirection; left: number; right: number }[];
  width: number; rem: number;
}, random: () => number): { pokemon: WalkerPokemon; direction: WalkerDirection; bags: WalkerBags } | null {
  const { actors, population, now, nextAt, pending, previous, width, rem, lastDirection } = request;
  if (pending || now < nextAt || actors.length >= WALKER_MAX) return null;
  const zone = replenishmentZone(actors, population);
  if (!zone) return null;
  let direction = entranceDirection(now, nextAt, lastDirection === 'east' ? 'west' : 'east', previous, width, rem);
  if (!direction) return null;
  const active = new Set(request.activeIds ?? []);
  const pool = request.pokemon.filter(pokemon => pokemon.zone === zone);
  if (!pool.length) return null;
  const draw = drawWalkerBag(request.bags[zone], pool.map(pokemon => pokemon.entityId), active, random);
  if (!draw) return null;
  if (lastDirection === null) direction = entranceDirection(now, nextAt, random() < 0.5 ? 'east' : 'west', previous, width, rem)!;
  return { pokemon: pool.find(pokemon => pokemon.entityId === draw.id)!, direction, bags: { ...request.bags, [zone]: draw.bag } };
}
export function appearanceSleep(variant: WalkerVariant, zone: 'ground' | 'sky', random: () => number) {
  if (zone !== 'ground' || !variant.sleep || random() >= 1 / 16) return null;
  return { atMs: 5000 + random() * 6000, durationMs: Math.min(20000, 10000 + Math.floor(random() * 10001)) };
}

export function withWalkerHeights(pokemon: readonly WalkerPokemon[], entities: readonly { id: string; attrs: { altura?: unknown } }[]): WalkerPokemon[] {
  const heights = new Map(entities.map((entity) => [entity.id, entity.attrs.altura]));
  return pokemon.map((entry) => {
    const height = ['base', 'alternate', 'cutscene', 'altcolor'].includes(entry.form) ? heights.get(entry.entityId) : undefined;
    const value = typeof height === 'number' && Number.isFinite(height) && height > 0 ? height : entry.formHeightMeters;
    return { ...entry, heightMeters: typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined };
  });
}

export const locomotionName = (pokemon: WalkerPokemon) => pokemon.locomotion ?? 'Walk';
export const locomotionAnimation = (pokemon: WalkerPokemon, variant: WalkerVariant) => variant.animations[locomotionName(pokemon)];

/** Select a native pose without changing the locomotion clock or its direction. */
export function playbackAnimation(pokemon: WalkerPokemon, variant: WalkerVariant, phase: WalkerPlayback['phase']): string {
  const burrow = pokemon.burrow, sleep = variant.sleep;
  if (burrow) return phase === 'emerge' ? burrow.emerge : phase === 'hide' ? burrow.hide : burrow.idle;
  if (phase === 'lie') return sleep?.enter ?? 'Idle';
  if (phase === 'sleep') return sleep?.sleep ?? 'Idle';
  if (phase === 'wake') return sleep?.wake ?? 'Idle';
  if (phase === 'fall' || phase === 'hold') return 'HitGround';
  return phase === 'recover' ? 'Idle' : locomotionName(pokemon);
}

/** Event poses face east. Duplicated east/west rows are also a single visual direction. */
export const mirrorsSheet = (sheet: WalkerSheet, direction: WalkerDirection, east?: WalkerSheet) => direction === 'west'
  && (sheet.sourceRows === 1 || Boolean(sheet.sha256 && east?.sha256 === sheet.sha256));

/** The union bbox locates the pivot; per-frame bboxes cancel the sheet's built-in bobbing. */
export function rollingGeometry(sheet: WalkerSheet, scale: number, mirrored = false, frameIndex = 0) {
  const centerX = sheet.bbox.x + sheet.bbox.width / 2;
  const centerY = sheet.bbox.y + sheet.bbox.height / 2;
  const frame = sheet.frames[frameIndex].bbox ?? sheet.bbox;
  const radius = Math.max(...sheet.frames.map((item) => item.bbox?.height ?? sheet.bbox.height)) * scale / 2;
  return { pivotX: (centerX - sheet.anchor.x) * scale * (mirrored ? -1 : 1),
    pivotY: (centerY - sheet.anchor.y) * scale, radius,
    frameOffsetX: centerX - frame.x - frame.width / 2,
    frameOffsetY: centerY - frame.y - frame.height / 2 };
}
export interface WalkerPose {
  x: number; y: number; angle: number; opacity: number;
  pivotX?: number; pivotY?: number; frameOffsetX?: number; frameOffsetY?: number;
}

export function walkerExtents(pokemon: WalkerPokemon, variant: WalkerVariant, scale: number, rem: number) {
  let top = 0, bottom = 0;
  const tilt = pokemon.movement === 'stagger' ? 9 : pokemon.movement === 'hop' ? 12 : 0;
  const animations = pokemon.zone === 'sky' ? [locomotionAnimation(pokemon, variant)] : Object.values(variant.animations);
  for (const animation of animations) for (const sheet of Object.values(animation.directions)) {
    if (pokemon.movement === 'roll' && animation === locomotionAnimation(pokemon, variant)) {
      const { pivotY, radius } = rollingGeometry(sheet, scale);
      top = Math.max(top, radius - pivotY); bottom = Math.max(bottom, radius + pivotY);
      continue;
    }
    for (const x of [sheet.bbox.x - sheet.anchor.x, sheet.bbox.x + sheet.bbox.width - sheet.anchor.x]) {
      for (const y of [sheet.bbox.y - sheet.anchor.y, sheet.bbox.y + sheet.bbox.height - sheet.anchor.y]) {
        for (const degrees of [-tilt, 0, tilt]) {
          const angle = degrees * Math.PI / 180;
          const rotatedY = (x * Math.sin(angle) + y * Math.cos(angle)) * scale;
          top = Math.max(top, -rotatedY); bottom = Math.max(bottom, rotatedY);
        }
      }
    }
  }
  if (pokemon.movement === 'hop') top += 1.7 * rem;
  if (pokemon.movement === 'zigzag') { top += 0.65 * rem; bottom += 0.65 * rem; }
  if (pokemon.movement === 'stagger') { top += 0.15 * rem; bottom += 0.15 * rem; }
  if (pokemon.movement === 'hover') { top += 1.25 * rem; bottom = Math.max(0, bottom - 0.75 * rem); }
  if (pokemon.movement === 'drift') { top += rem; bottom += rem; }
  return { top, bottom, height: top + bottom };
}

/** Usable sky ends at the treetops, even if that leaves less space than the ground boundary. */
export const walkerSkyFloor = (viewport: WalkerViewport) => Math.max(0, Math.min(viewport.height - viewport.ground, viewport.skyFloor ?? viewport.height - viewport.ground));
export const walkerVerticalArea = (pokemon: WalkerPokemon, viewport: WalkerViewport) => pokemon.zone === 'sky' ? walkerSkyFloor(viewport) : viewport.height - walkerSkyFloor(viewport);

export function walkerTargetHeight(pokemon: WalkerPokemon, variant: WalkerVariant, viewport: WalkerViewport): number {
  const mobile = compactWalkers(viewport.width, viewport.height, viewport.rem);
  const sky = pokemon.zone === 'sky';
  const unit = mobile ? 1 : viewport.rem / 16;
  const minimum = (sky ? mobile ? 36 : 56 : mobile ? 48 : 72) * unit;
  const maximum = (sky ? mobile ? 144 : 256 : mobile ? 176 : 320) * unit;
  const area = walkerVerticalArea(pokemon, viewport);
  const budget = Math.max(1, Math.min(maximum, area - 2 * viewport.rem));
  const compression = Math.min(1, budget / maximum);
  const native = Math.max(...Object.values(variant.animations.Walk.directions).map((sheet) => sheet.bbox.height));
  const height = pokemon.heightMeters === undefined ? undefined : pokemon.heightMeters * (pokemon.elongated ? 0.4 : 1);
  const desired = height !== undefined
    ? (sky ? mobile ? 62 : 104 : mobile ? 76 : 125) * unit * height ** 0.7 * compression
    : native * Math.max(1, viewport.artPixel / 2);
  return Math.min(budget, Math.max(minimum * compression, desired));
}

export function walkerScale(pokemon: WalkerPokemon, variant: WalkerVariant, viewport: WalkerViewport): number {
  const walk = Object.values(variant.animations.Walk.directions);
  const nativeHeight = Math.max(...walk.map(sheet => sheet.bbox.height));
  const locomotion = Object.values(locomotionAnimation(pokemon, variant).directions);
  // Un vuelo con alas abiertas no mide el largo del cuerpo: solo cuenta la marca explícita.
  const wingedFlight = pokemon.zone === 'sky' && locomotionName(pokemon) === 'Attack';
  // Un vuelo con el cuerpo estirado no mide el largo: la proporción se juzga con la caminata del mismo Pokémon.
  const basis = wingedFlight ? walk : locomotion;
  const elongated = Math.max(...basis.map(sheet => (sheet.referenceBbox ?? sheet.bbox).width)) > 1.25 * Math.max(...basis.map(sheet => (sheet.referenceBbox ?? sheet.bbox).height));
  // For long bodies the Pokédex measurement represents length. Keep Walk as the size
  // reference so a flight pose's open wings do not inflate or shrink the body itself.
  const reference = pokemon.zone === 'sky' ? walk : locomotion;
  const native = !pokemon.elongated && elongated ? Math.max(...reference.map(sheet => Math.max(sheet.bbox.width, sheet.bbox.height))) : nativeHeight;
  const target = walkerTargetHeight(pokemon, variant, viewport);
  const area = walkerVerticalArea(pokemon, viewport);
  const budget = Math.max(1, area - 2 * viewport.rem);
  let ideal = target / native * (pokemon.sizeFactor ?? 1);
  if (walkerExtents(pokemon, variant, ideal, viewport.rem).height > budget) {
    // Include fall/recovery and the entire special trajectory in the same fixed scale.
    let low = 0, high = ideal;
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2;
      if (walkerExtents(pokemon, variant, middle, viewport.rem).height <= budget) low = middle;
      else high = middle;
    }
    ideal = low;
  }
  const integer = Math.max(1, Math.round(ideal));
  return Math.abs(integer - ideal) / ideal <= 0.1 && walkerExtents(pokemon, variant, integer, viewport.rem).height <= budget
    ? integer : ideal;
}

type Interval = [number, number];
function subtractIntervals(intervals: Interval[], blocked: Interval): Interval[] {
  return intervals.flatMap(([lo, hi]): Interval[] => blocked[1] <= lo || blocked[0] >= hi ? [[lo, hi]]
    : [...(blocked[0] > lo ? [[lo, blocked[0]] as Interval] : []), ...(blocked[1] < hi ? [[blocked[1], hi] as Interval] : [])]);
}

/** Keep at least 40% of the vertical silhouette outside foreground obstacles. */
export function chooseGroundLane(low: number, high: number, visibleHeight: number, viewport: WalkerViewport, random: () => number) {
  let intervals: Interval[] = [[low, Math.max(low, high)]];
  const vertical = (viewport.occluders ?? []).filter((box) => box.x + box.width > 0 && box.x < viewport.width && box.height > 0)
    .map((box): Interval => [box.y, box.y + box.height]).sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const interval of vertical) {
    const previous = merged.at(-1);
    if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]);
    else merged.push([...interval]);
  }
  for (const [top, bottom] of merged) if (bottom - top >= visibleHeight * 0.6) intervals = subtractIntervals(intervals, [top + visibleHeight * 0.6, bottom + visibleHeight * 0.4]);
  if (!intervals.length) return { feetY: low, available: false };
  let separated = intervals;
  for (const occupied of viewport.occupiedLanes ?? []) separated = subtractIntervals(separated, [occupied - viewport.rem, occupied + viewport.rem]);
  if (separated.length) intervals = separated;
  const total = intervals.reduce((sum, [lo, hi]) => sum + hi - lo, 0);
  let distance = Math.max(0, Math.min(1, random())) * total;
  for (const [lo, hi] of intervals) {
    if (distance <= hi - lo) return { feetY: lo + distance, available: true };
    distance -= hi - lo;
  }
  return { feetY: intervals.at(-1)![1], available: true };
}

export function planWalker(pokemon: WalkerPokemon, viewport: WalkerViewport, random: () => number, options: { shiny?: boolean; direction?: WalkerDirection } = {}): WalkerPlan {
  const shiny = Boolean(pokemon.variants.shiny && (options.shiny ?? random() < 1 / SHINY_ODDS));
  const variant = shiny ? pokemon.variants.shiny! : pokemon.variants.normal;
  const direction = options.direction ?? (random() < 0.5 ? 'east' : 'west');
  const scale = walkerScale(pokemon, variant, viewport);
  const margin = Math.max(...Object.values(variant.animations).map((animation) => animation.directions[direction].frameWidth)) * scale;
  const start = direction === 'east' ? -margin : viewport.width + margin;
  const end = direction === 'east' ? viewport.width + margin : -margin;
  const speed = (pokemon.movement === 'run' ? 7 : pokemon.zone === 'sky' ? 4 : 3.5) * viewport.rem * (0.9 + random() * 0.2);
  const extents = walkerExtents(pokemon, variant, scale, viewport.rem);
  const padding = viewport.rem * 0.5;
  const groundTop = viewport.height - viewport.ground;
  const locomotion = locomotionAnimation(pokemon, variant);
  const visibleHeight = Math.max(...Object.values(locomotion.directions).map((sheet) => sheet.bbox.height)) * scale;
  const walking = locomotion.directions[direction];
  const walkingBottom = (walking.bbox.y + walking.bbox.height - walking.anchor.y) * scale;
  const lowFeet = Math.max(groundTop + padding, walkerSkyFloor(viewport) + padding + extents.top + walkingBottom);
  const highFeet = viewport.height - padding - extents.bottom + walkingBottom;
  const selected = pokemon.zone === 'ground'
    ? lowFeet <= highFeet ? chooseGroundLane(lowFeet, highFeet, visibleHeight, viewport, random) : { feetY: lowFeet, available: false }
    : { feetY: 0, available: extents.height + 2 * padding <= walkerSkyFloor(viewport) };
  const y = pokemon.zone === 'sky'
    ? extents.top + padding + random() * Math.max(0, walkerSkyFloor(viewport) - 2 * padding - extents.height)
    : selected.feetY - walkingBottom;
  const lane = pokemon.zone === 'ground' ? (selected.feetY - groundTop) / viewport.ground : 0;
  const plan: WalkerPlan = { pokemon, variant, shiny, direction, scale, speed,
    feetY: pokemon.zone === 'ground' ? selected.feetY : y + extents.bottom,
    lane, depth: pokemon.zone === 'ground' ? 100 + Math.round(lane * 1000) : 10,
    visibleHeight, canAppear: selected.available,
    start, end, y, durationMs: Math.abs(end - start) / speed * 1000 };
  if (pokemon.burrow) {
    // Provisional anchor; chooseBurrowPosition resolves x and lane together before mounting.
    plan.start = viewport.width / 2;
    plan.end = plan.start;
    plan.burrowIdleMs = 3000 + Math.max(0, Math.min(1, random())) * 3000;
    plan.durationMs = variant.animations[pokemon.burrow.emerge].directions[direction].totalDurationMs + plan.burrowIdleMs
      + variant.animations[pokemon.burrow.hide].directions[direction].totalDurationMs;
    return plan;
  }
  const initial = walkerFrameBounds(plan, 0, viewport.rem);
  const clearance = 2 * viewport.rem + 1;
  plan.start += direction === 'east' ? Math.min(0, -clearance - initial.right) : Math.max(0, viewport.width + clearance - initial.left);
  plan.durationMs = Math.abs(plan.end - plan.start) / speed * 1000;
  return plan;
}

/** Body clearance: Idle + DigOut and their shadows, with one rem around the union.
 * DigIn includes detached dirt particles; alpha bboxes cannot distinguish them from the body. */
export function burrowBounds(plan: WalkerPlan, rem: number) {
  const recipe = plan.pokemon.burrow;
  if (!recipe) throw new Error('Not a burrow sequence');
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const name of [recipe.idle, recipe.hide]) {
    const animation = plan.variant.animations[name];
    const sheet = animation.directions[plan.direction];
    const mirrored = mirrorsSheet(sheet, plan.direction, animation.directions.east);
    for (const source of [sheet, animation.shadow?.directions[plan.direction]]) {
      if (!source) continue;
      const box = source.bbox;
      const x1 = (box.x - source.anchor.x) * (mirrored ? -1 : 1), x2 = (box.x + box.width - source.anchor.x) * (mirrored ? -1 : 1);
      left = Math.min(left, x1, x2); right = Math.max(right, x1, x2);
      top = Math.min(top, box.y - source.anchor.y); bottom = Math.max(bottom, box.y + box.height - source.anchor.y);
    }
  }
  return { x: plan.start + left * plan.scale - rem, y: plan.y + top * plan.scale - rem,
    width: (right - left) * plan.scale + 2 * rem, height: (bottom - top) * plan.scale + 2 * rem };
}

/** Search the full grass in half-rem steps; validate geometry before any DOM hit-tests. */
export function chooseBurrowPosition(plan: WalkerPlan, viewport: WalkerViewport, random: () => number,
  uncovered: (box: WalkerBox) => boolean = () => true): WalkerPlan | null {
  const bounds = burrowBounds(plan, viewport.rem), groundTop = viewport.height - viewport.ground;
  const maxX = viewport.width - bounds.width, maxY = viewport.height - bounds.height;
  if (maxX < 0 || maxY < groundTop) return null;
  const step = viewport.rem / 2;
  const positions = (low: number, high: number) => {
    const values: number[] = [];
    for (let value = low; value < high; value += step) values.push(value);
    values.push(high);
    return values;
  };
  const preferred: WalkerBox[] = [], fallback: WalkerBox[] = [];
  const feetOffset = plan.feetY - plan.y;
  for (const y of positions(groundTop, maxY)) for (const x of positions(0, maxX)) {
    const box = { x, y, width: bounds.width, height: bounds.height };
    if (viewport.occluders?.some(rect => x < rect.x + rect.width && x + box.width > rect.x
      && y < rect.y + rect.height && y + box.height > rect.y)) continue;
    const feetY = y - (bounds.y - plan.y) + feetOffset;
    const separated = !viewport.occupiedLanes?.some(lane => Math.abs(lane - feetY) < viewport.rem);
    (separated ? preferred : fallback).push(box);
  }
  // Random traversal without replacement reaches every geometric gap, including both margins.
  for (const candidates of [preferred, fallback]) while (candidates.length) {
    const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)));
    const box = candidates[index];
    candidates[index] = candidates[candidates.length - 1]; candidates.pop();
    const start = plan.start + box.x - bounds.x, y = plan.y + box.y - bounds.y;
    const feetY = y + feetOffset, lane = (feetY - groundTop) / viewport.ground;
    const placed = { ...plan, start, end: start, y, feetY, lane, depth: 100 + Math.round(lane * 1000), canAppear: true };
    if (uncovered(burrowBounds(placed, viewport.rem))) return placed;
  }
  return null;
}

/** Uses visible logical time only; no fade, no horizontal travel and no catch-up while hidden. */
export function advanceBurrow(state: WalkerPlayback, deltaMs: number, durations: { emerge: number; idle: number; hide: number }): WalkerPlayback {
  let next = { ...state }, remaining = Math.max(0, deltaMs);
  while (remaining > 0 && next.phase !== 'done') {
    const duration = next.phase === 'emerge' ? durations.emerge : next.phase === 'burrow-idle' ? durations.idle : durations.hide;
    const consume = Math.min(remaining, Math.max(0, duration - next.phaseMs));
    next.phaseMs += consume; remaining -= consume;
    if (next.phaseMs >= duration) next = { ...next, phaseMs: 0, phase: next.phase === 'emerge' ? 'burrow-idle' : next.phase === 'burrow-idle' ? 'hide' : 'done' };
  }
  return next;
}

export function frameAt(sheet: WalkerSheet, elapsedMs: number, loop = true): number {
  let time = loop ? Math.max(0, elapsedMs) % sheet.totalDurationMs : Math.max(0, elapsedMs);
  for (let index = 0; index < sheet.frames.length; index++) {
    if (time < sheet.frames[index].durationMs) return index;
    time -= sheet.frames[index].durationMs;
  }
  return sheet.frames.length - 1;
}

export function advancePlayback(state: WalkerPlayback, deltaMs: number, fallMs: number, recoverMs: number, sleep?: { lieMs: number; sleepMs: number; wakeMs: number }): WalkerPlayback {
  let next = { ...state }, remaining = Math.max(0, deltaMs);
  while (remaining > 0) {
    if (next.phase === 'loading') break;
    if (next.phase === 'walk') { next.travelMs += remaining; next.phaseMs += remaining; break; }
    const duration = next.phase === 'fall' ? fallMs : next.phase === 'hold' ? HOLD_MS : next.phase === 'recover' ? recoverMs
      : next.phase === 'lie' ? sleep?.lieMs ?? 0 : next.phase === 'sleep' ? sleep?.sleepMs ?? 0 : sleep?.wakeMs ?? 0;
    const consume = Math.min(remaining, Math.max(0, duration - next.phaseMs));
    next.phaseMs += consume;
    remaining -= consume;
    if (next.phaseMs >= duration) next = { ...next, phaseMs: 0, phase: next.phase === 'fall' ? 'hold' : next.phase === 'hold' ? 'recover'
      : next.phase === 'lie' ? 'sleep' : next.phase === 'sleep' ? 'wake' : 'walk' };
  }
  return next;
}

export function walkerPose(plan: WalkerPlan, travelMs: number, rem: number): WalkerPose {
  if (plan.pokemon.burrow) return { x: plan.start, y: plan.y, angle: 0, opacity: 1 };
  const t = travelMs / 1000, progress = Math.min(1, travelMs / plan.durationMs);
  const x = plan.start + (plan.end - plan.start) * progress, opacity = 1;
  let dy = 0, angle = 0;
  const movement = plan.pokemon.movement;
  if (movement === 'roll') {
    const animation = locomotionAnimation(plan.pokemon, plan.variant);
    const sheet = animation.directions[plan.direction];
    const geometry = rollingGeometry(sheet, plan.scale, mirrorsSheet(sheet, plan.direction, animation.directions.east));
    return { x, y: plan.feetY - geometry.radius - geometry.pivotY,
      angle: (x - plan.start) / geometry.radius * 180 / Math.PI, opacity,
      pivotX: geometry.pivotX, pivotY: geometry.pivotY };
  }
  if (movement === 'stagger') { dy = Math.sin(t * 5) * rem * 0.15; angle = Math.sin(t * 3) * 9; }
  if (movement === 'zigzag') dy = Math.asin(Math.sin(t * 2.5)) / (Math.PI / 2) * rem * 0.65;
  if (movement === 'drift') dy = Math.sin(t * 1.6) * rem;
  if (movement === 'hop') { dy = -Math.abs(Math.sin(t * 4)) * rem * 1.7; angle = Math.sin(t * 4) * 12; }
  if (movement === 'hover') dy = -rem + Math.sin(t * 2) * rem * 0.25;
  const bob = plan.pokemon.locomotionBob;
  if (bob) dy += (Math.floor(travelMs / bob.ms) % 2) * bob.px * plan.scale;
  return { x: Math.round(x), y: Math.round(plan.y + dy), angle, opacity };
}

/** Full crop rectangle, including transparent margins, facing, roll pivot and rotation. */
export function walkerFrameBounds(plan: WalkerPlan, travelMs: number, rem: number) {
  const animation = locomotionAnimation(plan.pokemon, plan.variant), sheet = animation.directions[plan.direction];
  const mirrored = mirrorsSheet(sheet, plan.direction, animation.directions.east);
  const pose = walkerPose(plan, travelMs, rem);
  const geometry = plan.pokemon.movement === 'roll' ? rollingGeometry(sheet, plan.scale, mirrored, frameAt(sheet, travelMs)) : null;
  const angle = pose.angle * Math.PI / 180;
  const points = [0, sheet.frameWidth].flatMap(x => [0, sheet.frameHeight].map(y => {
    const localX = (x - sheet.anchor.x + (geometry?.frameOffsetX ?? 0)) * plan.scale * (mirrored ? -1 : 1) - (pose.pivotX ?? 0);
    const localY = (y - sheet.anchor.y + (geometry?.frameOffsetY ?? 0)) * plan.scale - (pose.pivotY ?? 0);
    return { x: pose.x + (pose.pivotX ?? 0) + localX * Math.cos(angle) - localY * Math.sin(angle),
      y: pose.y + (pose.pivotY ?? 0) + localX * Math.sin(angle) + localY * Math.cos(angle) };
  }));
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}

export function spritePixel(point: { x: number; y: number }, pose: ReturnType<typeof walkerPose>, scale: number, sheet: WalkerSheet, mirrored = false) {
  const angle = -pose.angle * Math.PI / 180, x = point.x - pose.x - (pose.pivotX ?? 0), y = point.y - pose.y - (pose.pivotY ?? 0);
  return { x: Math.floor(((x * Math.cos(angle) - y * Math.sin(angle)) + (pose.pivotX ?? 0)) / scale * (mirrored ? -1 : 1) + sheet.anchor.x - (pose.frameOffsetX ?? 0)),
    y: Math.floor(((x * Math.sin(angle) + y * Math.cos(angle)) + (pose.pivotY ?? 0)) / scale + sheet.anchor.y - (pose.frameOffsetY ?? 0)) };
}

export function hitsSprite(point: { x: number; y: number }, pose: ReturnType<typeof walkerPose>, scale: number, sheet: WalkerSheet, frameIndex: number, pixels: Uint8ClampedArray, mirrored = false): boolean {
  const local = spritePixel(point, pose, scale, sheet, mirrored);
  if (local.x < 0 || local.y < 0 || local.x >= sheet.frameWidth || local.y >= sheet.frameHeight) return false;
  const frame = sheet.frames[frameIndex];
  return pixels[((local.y + frame.y) * sheet.width + local.x + frame.x) * 4 + 3] > 0;
}

/** Pointer-only easter egg: preserve the travel clock and use the current pose's opaque pixels. */
export function wakeFromPointer(state: WalkerPlayback, pointer: {
  hidden: boolean; dialogOpen: boolean; uncovered: boolean; pointerType: string; button: number;
  point: { x: number; y: number }; pose: WalkerPose; scale: number; sheet: WalkerSheet;
  frame: number; pixels: Uint8ClampedArray; mirrored?: boolean;
}): WalkerPlayback {
  if (!['lie', 'sleep'].includes(state.phase) || pointer.hidden || pointer.dialogOpen || !pointer.uncovered
    || (pointer.pointerType === 'mouse' && pointer.button !== 0)
    || !hitsSprite(pointer.point, pointer.pose, pointer.scale, pointer.sheet, pointer.frame, pointer.pixels, pointer.mirrored)) return state;
  return { ...state, phase: 'wake', phaseMs: 0 };
}

/** No hidden-tab catch-up: resetting last on pause preserves the logical clock. */
export function visibleDelta(last: number | null, now: number, hidden: boolean): { last: number | null; delta: number } {
  return hidden ? { last: null, delta: 0 } : { last: now, delta: last === null ? 0 : Math.max(0, now - last) };
}

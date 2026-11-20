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
  /** `offsetX`: cuánto se corre el cuadro de lado (px de arte) para cancelar un deslizamiento propio de la animación. */
  frames: { x: number; y: number; durationMs: number; bbox: WalkerBox | null; offsetX?: number }[];
}
export interface WalkerVariant {
  hasHitGround: boolean;
  sleep?: { enter: string | null; sleep: string; wake: string } | null;
  animations: Record<string, { directions: Record<WalkerDirection, WalkerSheet>; shadow?: { directions: Record<WalkerDirection, WalkerSheet> } }>;
}
export interface WalkerPokemon {
  formHeightMeters?: number;
  /** Altura con la que se dibuja al caminar (manda sobre la de la Pokédex): para que no quede diminuto junto a su familia. */
  walkHeightMeters?: number;
  /** Nadadores: cuánto del cuerpo (fracción del alto) queda bajo el agua; por defecto `SUBMERGE`. */
  submergeFraction?: number;
  sizeFactor?: number;
  elongated?: boolean;
  entityId: string; name: string; number: number; dex: string; form: string;
  zone: 'ground' | 'sky' | 'water'; movement: WalkerMovement;
  locomotion?: string;
  /** Subida y bajada en pasos mientras avanza (un cuadro arriba, otro abajo). */
  locomotionBob?: { ms: number; px: number };
  burrow?: { emerge: string; idle: string; hide: string };
  /** Se dibuja como una fila de `count` miembros iguales (Falinks): cada aparición elige una formación al azar. */
  group?: { count: number };
  heightMeters?: number;
  variants: { normal: WalkerVariant; shiny: WalkerVariant | null };
}
export interface WalkerManifest { version: number; pokemon: WalkerPokemon[] }
export interface WalkerViewport {
  width: number; height: number; rem: number; artPixel: number; ground: number;
  occluders?: readonly WalkerBox[]; occupiedLanes?: readonly number[];
  /** El agua del fondo (el río): arriba y abajo, en píxeles de pantalla. Los nadadores pisan solo ahí. */
  water?: { top: number; bottom: number };
  /** Distancia mínima entre dos carriles ocupados (por defecto, un rem): el desfile pide más aire entre sus integrantes. */
  laneGap?: number;
  /** Y de la copa más alta de los árboles: los voladores nunca bajan de ahí. */
  skyFloor?: number;
}
/** Las barras de scroll y las oclusiones no cambian la geometría del reloj de la escena. */
export function sameWalkerGeometry(a: WalkerViewport, b: WalkerViewport): boolean {
  return a.width === b.width && a.height === b.height && a.rem === b.rem
    && a.artPixel === b.artPixel && a.ground === b.ground && a.water?.top === b.water?.top && a.water?.bottom === b.water?.bottom;
}

/** Las formas en que un grupo cruza la pantalla: fila recta, fila escalonada, bolos (1-2-3) y círculo. Todas avanzan derecho. */
export type FormationKind = 'line' | 'stagger' | 'pins' | 'ring';
export const FORMATION_KINDS: readonly FormationKind[] = ['line', 'stagger', 'pins', 'ring'];
/** Lo más que se separa un miembro del carril del líder, en alturas de miembro: ninguna formación lo supera. */
export const GROUP_LIFT = 0.6;
export interface WalkerFormation {
  kind: FormationKind;
  /** Un número en [0, 1) por miembro: reparte el escalonado y desfasa los pasos. */
  seeds: readonly number[];
  /** Ancho y alto del cuerpo de un miembro en pantalla (píxeles de CSS). */
  unitW: number; unitH: number;
  /** Distancia del líder al último miembro (píxeles de CSS), medida contra el sentido de la marcha. */
  span: number;
}
/** Dónde va un miembro respecto del líder: `back` atrás (contra la marcha) y `lift` hacia abajo, en píxeles de CSS. */
export interface FormationSlot { back: number; lift: number }

const memberGap = (unitW: number) => unitW * 1.1;
const ringRadius = (unitW: number, count: number) => Math.max(memberGap(unitW) * 0.9, count * memberGap(unitW) / (2 * Math.PI));
/** Los bolos van en filas de 1, 2, 3, 4…: cuántas filas hacen falta para `count` miembros. */
const pinRows = (count: number) => Math.max(1, Math.ceil((Math.sqrt(8 * count + 1) - 1) / 2));

/** Cuánto se estira la formación hacia atrás. */
export function formationSpan(kind: FormationKind, count: number, unitW: number): number {
  const gap = memberGap(unitW);
  if (kind === 'ring') return 2 * ringRadius(unitW, count);
  if (kind === 'pins') return (pinRows(count) - 1) * gap * 0.9;
  return Math.max(0, count - 1) * gap;
}

/** Puestos de los miembros en el instante `seconds` de la marcha. Pura: el mismo plan y el mismo instante dan los mismos puestos. */
export function formationSlots(formation: Pick<WalkerFormation, 'kind' | 'seeds' | 'unitW' | 'unitH'>, count: number, seconds: number): FormationSlot[] {
  const { kind, seeds, unitW, unitH } = formation;
  const gap = memberGap(unitW), limit = GROUP_LIFT * unitH, turn = 2 * Math.PI;
  const slots: FormationSlot[] = [];
  const rx = ringRadius(unitW, count), ry = Math.min(limit, rx * 0.5);
  // Bolos: la última fila (la más ancha) llega justo al tope vertical.
  const rows = pinRows(count), pinStep = limit / Math.max(1, (rows - 1) / 2);
  let row = 0, firstOfRow = 0;
  for (let index = 0; index < count; index++) {
    const seed = seeds[index] ?? 0;
    if (kind === 'line') slots.push({ back: index * gap, lift: 0 });
    else if (kind === 'stagger') {
      // Cada uno un poco más arriba o más abajo, alternando, con una deriva lenta para que no se vea clavado.
      const base = (index % 2 === 0 ? -1 : 1) * (0.3 + 0.7 * seed) * 0.75 * limit;
      slots.push({ back: index * gap, lift: base + Math.sin(seconds * 0.8 + seed * turn) * 0.25 * limit });
    } else if (kind === 'pins') {
      // Uno al frente, dos atrás, tres más atrás: cada fila centrada en el carril del líder.
      if (index - firstOfRow > row) { firstOfRow = index; row++; }
      slots.push({ back: row * gap * 0.9, lift: (index - firstOfRow - row / 2) * pinStep });
    } else {
      // Círculo fijo: la formación es un óvalo (aplastado por la perspectiva del suelo) y no gira; el grupo avanza derecho.
      const angle = turn * index / count;
      slots.push({ back: rx * (1 - Math.cos(angle)), lift: ry * Math.sin(angle) });
    }
  }
  return slots;
}

/** Los pasos de una fila recta o de los bolos van al compás; en las demás cada miembro tiene su propio desfase. */
export const formationStepOffsetMs = (kind: FormationKind, seed: number, cycleMs: number) => kind === 'line' || kind === 'pins' ? 0 : seed * cycleMs;

export interface WalkerPlan {
  pokemon: WalkerPokemon; variant: WalkerVariant; shiny: boolean; direction: WalkerDirection;
  formation?: WalkerFormation;
  scale: number; speed: number; start: number; end: number; y: number; durationMs: number;
  feetY: number; depth: number; lane: number; visibleHeight: number; canAppear: boolean;
  burrowIdleMs?: number;
  /** Nadadores: cuánto del cuerpo queda bajo el agua (px de CSS); lo de abajo de la línea de flotación (`feetY`) no se dibuja. */
  submerge?: number;
}
export interface WalkerPlayback {
  phase: 'walk' | 'loading' | 'fall' | 'hold' | 'recover' | 'lie' | 'sleep' | 'wake' | 'emerge' | 'burrow-idle' | 'hide' | 'done'; phaseMs: number; travelMs: number;
}
export const INITIAL_PLAYBACK: WalkerPlayback = { phase: 'walk', phaseMs: 0, travelMs: 0 };
export const HOLD_MS = 700;
export const SHINY_ODDS = 512;
export const WALKER_MAX = 6;
export const nextEntranceMs = (now: number, random: () => number) => now + 1500 + Math.max(0, Math.min(1, random())) * 1000;

/** Evento raro: Eevee y todas sus evoluciones cruzan juntas, sueltas, por los dos lados y cada una en su carril. */
export const PARADE_IDS: readonly string[] = ['eevee', 'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon'];
/** Evento raro: Latios y Latias cruzan el cielo juntos, para el mismo lado, uno más alto y otro más bajo. */
export const DUO_IDS: readonly string[] = ['latios', 'latias'];
/** Velocidad común del vuelo de los dos (rem por segundo; la de cualquier volador). */
export const DUO_SPEED_REM = 4;
/** Velocidad común del desfile (en rem por segundo): la misma para todos, así mantienen la distancia que traen. */
export const PARADE_SPEED_REM = 3.5;
/** Entre ocho y doce minutos de reloj visible entre un evento y el siguiente (cualquiera de los siete). */
export const nextEventMs = (now: number, random: () => number) => now + 8 * 60_000 + Math.max(0, Math.min(1, random())) * 4 * 60_000;

/**
 * Quién sale de cada lado del desfile y cuánto más atrás. `behind` es la distancia extra a la entrada normal (píxeles de CSS).
 * Todos van a la misma velocidad, así que los de un mismo lado conservan siempre la distancia con la que salen: cada uno queda
 * a más de su ancho del anterior, nunca pegado. Los dos lados se cruzan por el medio, cada uno en su carril.
 */
export function planParade(members: readonly { id: string; width: number }[], viewport: Pick<WalkerViewport, 'rem'>, random: () => number): { id: string; behind: number; direction: WalkerDirection }[] {
  const unit = (value: number) => Math.max(0, Math.min(0.999999, value));
  const order = [...members];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(unit(random()) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Mitad y mitad (con uno más de un lado o del otro al azar si son impares).
  const split = Math.floor(order.length / 2) + (order.length % 2 === 1 && random() < 0.5 ? 1 : 0);
  const sides: [WalkerDirection, typeof order][] = [['east', order.slice(0, split)], ['west', order.slice(split)]];
  const lineup: { id: string; behind: number; direction: WalkerDirection }[] = [];
  for (const [direction, side] of sides) {
    let behind = unit(random()) * 4 * viewport.rem;
    side.forEach((member, index) => {
      if (index > 0) behind += (side[index - 1].width + member.width) / 2 * (1.15 + 0.7 * unit(random())) + 2 * viewport.rem;
      lineup.push({ id: member.id, behind, direction });
    });
  }
  return lineup;
}

/**
 * Latios y Latias: los dos para el mismo lado, el segundo bien atrás del primero (más que sus anchos juntos y varios rem de aire),
 * y cada uno en su mitad del cielo (`band`, de 0 a 1 sobre el alto disponible), así nunca se tapan.
 */
export function planDuo(members: readonly { id: string; width: number }[], viewport: Pick<WalkerViewport, 'rem'>, random: () => number): { id: string; behind: number; direction: WalkerDirection; band: readonly [number, number] }[] {
  const unit = (value: number) => Math.max(0, Math.min(0.999999, value));
  const direction: WalkerDirection = unit(random()) < 0.5 ? 'east' : 'west';
  const order = [...members];
  if (unit(random()) < 0.5) order.reverse();
  const upperFirst = unit(random()) < 0.5;
  let behind = unit(random()) * 2 * viewport.rem;
  return order.map((member, index) => {
    if (index > 0) behind += (order[index - 1].width + member.width) / 2 * (1.6 + 0.8 * unit(random())) + 4 * viewport.rem;
    const upper = (index === 0) === upperFirst;
    return { id: member.id, behind, direction, band: (upper ? [0, 0.45] : [0.55, 1]) as readonly [number, number] };
  });
}

/** Los ocho eventos raros de la decoración. */
export type WalkerEventKind = 'parade' | 'duo' | 'dogs' | 'birds' | 'family' | 'race' | 'outbreak' | 'lake';
export const EVENT_KINDS: readonly WalkerEventKind[] = ['parade', 'duo', 'dogs', 'birds', 'family', 'race', 'outbreak', 'lake'];

/** Perros legendarios: uno al medio, otro un poco atrás y arriba, el tercero un poco más atrás y abajo. Todos para el mismo lado. */
export const DOG_IDS: readonly string[] = ['raikou', 'entei', 'suicune'];
export const DOG_SPEED_REM = 7;
/** Pájaros legendarios: los tres de siempre y los tres de Galar (el Zapdos de Galar corre por el pasto); tres para cada lado. */
export const BIRD_IDS: readonly string[] = ['articuno', 'zapdos', 'moltres', 'articuno-galar', 'zapdos-galar', 'moltres-galar'];
export const BIRD_SPEED_REM = 4;
/** Líneas evolutivas de tres etapas que marchan juntas en cuña, de la más chica (al frente) a la más grande (solo las que caminan por el pasto). */
export const FAMILY_LINES: readonly (readonly [string, string, string])[] = [
  ['bulbasaur', 'ivysaur', 'venusaur'], ['squirtle', 'wartortle', 'blastoise'], ['chikorita', 'bayleef', 'meganium'],
  ['cyndaquil', 'quilava', 'typhlosion'], ['totodile', 'croconaw', 'feraligatr'], ['treecko', 'grovyle', 'sceptile'],
  ['torchic', 'combusken', 'blaziken'], ['mudkip', 'marshtomp', 'swampert'], ['turtwig', 'grotle', 'torterra'],
  ['chimchar', 'monferno', 'infernape'], ['piplup', 'prinplup', 'empoleon'], ['snivy', 'servine', 'serperior'],
  ['tepig', 'pignite', 'emboar'], ['oshawott', 'dewott', 'samurott'], ['chespin', 'quilladin', 'chesnaught'],
  ['fennekin', 'braixen', 'delphox'], ['froakie', 'frogadier', 'greninja'], ['rowlet', 'dartrix', 'decidueye'],
  ['litten', 'torracat', 'incineroar'], ['popplio', 'brionne', 'primarina'], ['grookey', 'thwackey', 'rillaboom'],
  ['scorbunny', 'raboot', 'cinderace'], ['sobble', 'drizzile', 'inteleon'], ['pichu', 'pikachu', 'raichu'],
  ['larvitar', 'pupitar', 'tyranitar'], ['gible', 'gabite', 'garchomp'], ['ralts', 'kirlia', 'gardevoir'],
  ['shinx', 'luxio', 'luxray'], ['nidoran-m', 'nidorino', 'nidoking'],
];
export const FAMILY_SPEED_REM = 3.5;
/** Carrera de rodantes: Electrode es un poco más rápido que Voltorb y lo pasa. */
export const RACE_SPEEDS_REM: Readonly<Record<string, number>> = { voltorb: 6.5, electrode: 8.5 };
/**
 * Lago: Pokémon que nadan por el río, para el mismo lado, sorteados de este grupo. Solo Pokémon sin patas que pisen: de verdad nadan,
 * no caminan sobre el agua.
 */
export const LAKE_IDS: readonly string[] = ['lapras', 'kyogre', 'wailord', 'wailmer', 'gyarados', 'milotic', 'sharpedo', 'dewgong',
  'lanturn', 'finizen', 'palafin', 'tentacool', 'tentacruel', 'phione', 'manaphy'];
/** Los que siempre nadan por las alturas de abajo del río: más arriba parecerían volar sobre el agua. */
export const LAKE_LOW_LANE: readonly string[] = ['kyogre'];
/** Cuántos nadan a la vez (se sortean de LAKE_IDS). */
export const LAKE_COUNT = 3;
export const LAKE_SPEED_REM = 3;
/** Brote de Diglett: cuántos asoman a la vez (menos en pantallas chicas). */
export const OUTBREAK_COUNT = { regular: 10, compact: 6 };

/** Cada integrante de un evento: quién, cuánto más atrás sale, hacia dónde, a qué ritmo y dónde (franja del cielo o altura del pasto). */
export interface EventEntry {
  id: string; behind: number; direction: WalkerDirection; speedRem: number;
  /** Franja del cielo (0 a 1 del alto libre) para voladores. */
  band?: readonly [number, number];
  /** Altura de los pies en el pasto (0 arriba del pasto, 1 abajo) para los que caminan. */
  lane?: number;
  /** Espera antes de aparecer (el brote de Diglett no sale todo junto). */
  delayMs?: number;
  /** Puede haber más de uno de la misma especie a la vez. */
  copy?: boolean;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.max(0, Math.min(0.999999, random())) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Bolsa de eventos: salen los siete en orden aleatorio antes de que se repita ninguno. Devuelve la bolsa que queda. */
export function drawEventKind(bag: readonly WalkerEventKind[], random: () => number): { kind: WalkerEventKind; bag: readonly WalkerEventKind[] } {
  const [kind, ...rest] = bag.length ? bag : shuffled(EVENT_KINDS, random);
  return { kind, bag: rest };
}

/**
 * Hasta dónde llega el cuerpo a cada lado del punto de anclaje (píxeles de CSS), en promedio de los cuadros de la caminata y ya espejado
 * según hacia dónde mira. Un sprite grande no está centrado en su ancla: con esto se mide el borde real, no el ancho.
 */
export function walkerBodyExtent(pokemon: WalkerPokemon, viewport: WalkerViewport, direction: WalkerDirection): { left: number; right: number } {
  const variant = pokemon.variants.normal, animation = locomotionAnimation(pokemon, variant);
  const sheet = animation.directions[direction], scale = walkerScale(pokemon, variant, viewport);
  const boxes = sheet.frames.map((frame) => frame.bbox).filter((box): box is WalkerBox => box !== null);
  const used = boxes.length ? boxes : [sheet.bbox];
  const mean = (pick: (box: WalkerBox) => number) => used.reduce((sum, box) => sum + pick(box), 0) / used.length;
  const left = (mean((box) => box.x) - sheet.anchor.x) * scale, right = (mean((box) => box.x + box.width) - sheet.anchor.x) * scale;
  return mirrorsSheet(sheet, direction, animation.directions.east) ? { left: -right, right: -left } : { left, right };
}

/** Alto del cuerpo de un Pokémon caminando, en píxeles de CSS, a la escala que le toca en esta escena. */
export function walkerBodyHeight(pokemon: WalkerPokemon, viewport: WalkerViewport): number {
  const variant = pokemon.variants.normal;
  return Math.max(...Object.values(locomotionAnimation(pokemon, variant).directions).map((sheet) => sheet.bbox.height)) * walkerScale(pokemon, variant, viewport);
}

/**
 * Arma un evento a partir de lo que hay en el manifiesto. Pura: el azar entra por `random`. Devuelve null si falta algún integrante.
 * Todos los integrantes de un evento van a la misma velocidad (salvo la carrera), así que conservan la distancia con la que salen.
 */
export function planEvent(kind: WalkerEventKind, pokemon: readonly WalkerPokemon[], viewport: WalkerViewport, random: () => number): EventEntry[] | null {
  const unit = (value: number) => Math.max(0, Math.min(0.999999, value));
  const find = (id: string) => pokemon.find((entry) => entry.entityId === id);
  const all = (ids: readonly string[]) => { const found = ids.map(find); return found.every((entry) => entry) ? found as WalkerPokemon[] : null; };
  const width = (entry: WalkerPokemon) => walkerBodyWidth(entry, viewport);
  const direction: WalkerDirection = unit(random()) < 0.5 ? 'east' : 'west';
  const rem = viewport.rem;
  /**
   * Salen en cadena sobre una referencia común: al marchar a la misma velocidad conservan la distancia con la que salen. La distancia
   * se mide entre los bordes reales de los cuerpos (no entre anclas ni anchos), con `gap` px de aire entre ellos. Cada Pokémon entra
   * desde un punto distinto (un sprite grande empieza más lejos), así que `behind` se calcula contra ese punto de entrada natural.
   */
  const place = (order: readonly WalkerPokemon[], dir: WalkerDirection, gap: (prev: WalkerPokemon, entry: WalkerPokemon) => number) => {
    const offsets = [0];
    for (let index = 1; index < order.length; index++) {
      const previous = walkerBodyExtent(order[index - 1], viewport, dir), current = walkerBodyExtent(order[index], viewport, dir);
      const need = dir === 'east' ? current.right - previous.left : previous.right - current.left;
      const smaller = Math.min(width(order[index - 1]), width(order[index]));
      offsets.push(offsets[index - 1] + Math.max(need + gap(order[index - 1], order[index]), 0.25 * smaller));
    }
    const natural = order.map((entry) => planWalker(entry, viewport, () => 0.5, { direction: dir }).start);
    const reference = dir === 'east' ? Math.min(...order.map((_, i) => natural[i] + offsets[i])) : Math.max(...order.map((_, i) => natural[i] - offsets[i]));
    return order.map((_, i) => dir === 'east' ? natural[i] - reference + offsets[i] : reference + offsets[i] - natural[i]);
  };
  /** La cuña de los perros y de la familia: uno al medio, el segundo un poco atrás y arriba, el tercero un poco más atrás y abajo. */
  const wedge = (order: readonly WalkerPokemon[], speedRem: number) => {
    const average = order.reduce((sum, entry) => sum + walkerBodyHeight(entry, viewport), 0) / order.length;
    const spread = Math.min(0.3, Math.max(0.12, 0.6 * average / Math.max(1, viewport.ground)));
    const lanes = [0.5, 0.5 - spread, 0.5 + spread];
    const behinds = place(order, direction, (previous, entry) => 0.12 * Math.min(width(previous), width(entry)) + 0.5 * rem);
    return order.map((entry, index) => ({ id: entry.entityId, behind: behinds[index], direction, speedRem, lane: lanes[index] }));
  };
  if (kind === 'parade') {
    const members = all(PARADE_IDS);
    return members && planParade(members.map((entry) => ({ id: entry.entityId, width: width(entry) })), viewport, random).map((entry) => ({ ...entry, speedRem: PARADE_SPEED_REM }));
  }
  if (kind === 'duo') {
    const members = all(DUO_IDS);
    return members && planDuo(members.map((entry) => ({ id: entry.entityId, width: width(entry) })), viewport, random).map((entry) => ({ ...entry, speedRem: DUO_SPEED_REM }));
  }
  if (kind === 'dogs') {
    const members = all(DOG_IDS);
    return members && wedge(shuffled(members, random), DOG_SPEED_REM);
  }
  if (kind === 'birds') {
    const members = all(BIRD_IDS);
    if (!members) return null;
    // Tres para cada lado, al azar. Los cinco voladores, cada uno en una quinta parte del cielo, para que no se tapen al cruzarse.
    const order = shuffled(members, random);
    const flyers = order.filter((entry) => entry.zone === 'sky');
    const slices = shuffled(flyers.map((_, index) => index), random);
    const entries: EventEntry[] = [];
    for (const [side, group] of [['east', order.slice(0, 3)], ['west', order.slice(3)]] as const) {
      const behinds = place(group, side, (previous, entry) => (0.1 + 0.4 * unit(random())) * (width(previous) + width(entry)) / 2 + 2 * rem);
      group.forEach((entry, index) => {
        const slice = flyers.indexOf(entry);
        entries.push({
          id: entry.entityId, behind: behinds[index], direction: side, speedRem: BIRD_SPEED_REM,
          ...(slice >= 0 ? { band: [slices[slice] / flyers.length, (slices[slice] + 1) / flyers.length] as const } : { lane: 0.3 + 0.4 * unit(random()) }),
        });
      });
    }
    return entries;
  }
  if (kind === 'family') {
    const lines = FAMILY_LINES.filter((line) => line.every((id) => find(id)?.zone === 'ground'));
    if (!lines.length) return null;
    const line = lines[Math.floor(unit(random()) * lines.length)];
    return wedge(all(line)!, FAMILY_SPEED_REM);
  }
  if (kind === 'race') {
    const members = all(Object.keys(RACE_SPEEDS_REM));
    if (!members) return null;
    const lanes = unit(random()) < 0.5 ? [0.35, 0.65] : [0.65, 0.35];
    return members.map((entry, index) => ({ id: entry.entityId, behind: index === 0 ? 0 : unit(random()) * 2 * rem, direction, speedRem: RACE_SPEEDS_REM[entry.entityId], lane: lanes[index] }));
  }
  if (kind === 'lake') {
    const pool = LAKE_IDS.filter((id) => find(id));
    if (pool.length < 2) return null;
    const chosen = all(shuffled(pool, random).slice(0, LAKE_COUNT))!;
    // Las alturas del río, sorteadas; pero los de LAKE_LOW_LANE se quedan con las más bajas.
    const heights = [0.2, 0.5, 0.8].slice(0, chosen.length).sort((x, y) => y - x);
    const lanes: number[] = new Array(chosen.length);
    chosen.forEach((entry, index) => { if (LAKE_LOW_LANE.includes(entry.entityId)) lanes[index] = heights.shift()!; });
    const rest = shuffled(heights, random);
    chosen.forEach((_, index) => { if (lanes[index] === undefined) lanes[index] = rest.shift()!; });
    const behinds = place(chosen, direction, (previous, entry) => 0.2 * Math.min(width(previous), width(entry)) + 2 * rem);
    return chosen.map((entry, index) => ({ id: entry.entityId, behind: behinds[index], direction, speedRem: LAKE_SPEED_REM, lane: lanes[index] }));
  }
  // Brote de Diglett y Dugtrio.
  if (!all(['diglett', 'dugtrio'])) return null;
  const count = compactWalkers(viewport.width, viewport.height, rem) ? OUTBREAK_COUNT.compact : OUTBREAK_COUNT.regular;
  let delay = 0;
  return Array.from({ length: count }, (_, index) => {
    delay += index === 0 ? 0 : 150 + unit(random()) * 300;
    return { id: unit(random()) < 0.6 ? 'diglett' : 'dugtrio', behind: 0, direction, speedRem: FAMILY_SPEED_REM, delayMs: delay, copy: true };
  });
}

/** Ancho que ocupa el cuerpo de un Pokémon caminando, en píxeles de CSS, a la escala que le toca en esta escena. */
export function walkerBodyWidth(pokemon: WalkerPokemon, viewport: WalkerViewport): number {
  const variant = pokemon.variants.normal;
  const width = Math.max(...Object.values(locomotionAnimation(pokemon, variant).directions).map((sheet) => sheet.bbox.width));
  return width * walkerScale(pokemon, variant, viewport);
}

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
  // Un caminante menos por el pasto y uno más nadando en el río (pedido del usuario): el total de la escena no cambia.
  return {
    ground: { min: Math.max(1, groundMin - 1), max: (compact ? Math.min(4, groundMin + 2) : 4) - 1 },
    sky: { min: 1, max: 2 },
    // Nadadores: a veces ninguno y a veces hasta dos; cuándo sale uno lo decide `nextSwimMs` (no hay uno por obligación).
    water: { min: 0, max: 2 },
  };
}
export function walkerCapacity(width: number, height: number, rem: number): number {
  const target = walkerPopulation(width, height, rem);
  return Math.min(WALKER_MAX, target.ground.max + target.sky.max + target.water.max);
}
/** Entre veinte segundos y minuto y cuarenta de reloj visible hasta que puede salir el próximo nadador normal. */
export const nextSwimMs = (now: number, random: () => number) => now + 20_000 + Math.max(0, Math.min(1, random())) * 80_000;

export function replenishmentZone(actors: readonly { zone: 'ground' | 'sky' | 'water'; walking: boolean }[], population: ReturnType<typeof walkerPopulation>, waterReady = true): 'ground' | 'sky' | 'water' | null {
  if (actors.length >= WALKER_MAX) return null;
  for (const buffer of [0, 1]) for (const zone of ['sky', 'ground', 'water'] as const) {
    const count = actors.filter((actor) => actor.zone === zone);
    // El río no se repone por mínimo: sale un nadador solo cuando toca (`waterReady`) y hay lugar.
    if (zone === 'water') { if (buffer === 0 && waterReady && count.length < population.water.max) return zone; continue; }
    if (count.length < population[zone].max && count.filter((actor) => actor.walking).length < population[zone].min + buffer) return zone;
  }
  return null;
}

/** No species draw until cadence, capacity and a shared entrance are all available. */
export interface WalkerBag { key: string; remaining: readonly string[]; cycle: number }
export type WalkerBags = Record<'ground' | 'sky' | 'water', WalkerBag>;
export const createWalkerBags = (): WalkerBags => ({ ground: { key: '', remaining: [], cycle: 0 }, sky: { key: '', remaining: [], cycle: 0 }, water: { key: '', remaining: [], cycle: 0 } });

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
  actors: readonly { zone: 'ground' | 'sky' | 'water'; walking: boolean }[];
  population: ReturnType<typeof walkerPopulation>;
  now: number; nextAt: number; pending: boolean; lastDirection: WalkerDirection | null;
  /** Ya toca que salga un nadador (por defecto sí): lo marca `nextSwimMs`. */
  waterReady?: boolean;
  /** Pokémon ya en escena: dos iguales nunca conviven. */
  activeIds?: readonly string[];
  previous: readonly { direction: WalkerDirection; left: number; right: number }[];
  width: number; rem: number;
}, random: () => number): { pokemon: WalkerPokemon; direction: WalkerDirection; bags: WalkerBags } | null {
  const { actors, population, now, nextAt, pending, previous, width, rem, lastDirection } = request;
  if (pending || now < nextAt || actors.length >= WALKER_MAX) return null;
  const zone = replenishmentZone(actors, population, request.waterReady ?? true);
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
export function appearanceSleep(variant: WalkerVariant, zone: 'ground' | 'sky' | 'water', random: () => number) {
  if (zone !== 'ground' || !variant.sleep || random() >= 1 / 16) return null;
  return { atMs: 5000 + random() * 6000, durationMs: Math.min(20000, 10000 + Math.floor(random() * 10001)) };
}

export function withWalkerHeights(pokemon: readonly WalkerPokemon[], entities: readonly { id: string; attrs: { altura?: unknown } }[]): WalkerPokemon[] {
  const heights = new Map(entities.map((entity) => [entity.id, entity.attrs.altura]));
  return pokemon.map((entry) => {
    const height = ['base', 'alternate', 'cutscene', 'altcolor'].includes(entry.form) ? heights.get(entry.entityId) : undefined;
    const value = entry.walkHeightMeters ?? (typeof height === 'number' && Number.isFinite(height) && height > 0 ? height : entry.formHeightMeters);
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
  if (pokemon.group) {
    const member = Math.max(...Object.values(locomotionAnimation(pokemon, variant).directions).map((sheet) => sheet.bbox.height)) * scale;
    top += GROUP_LIFT * member; bottom += GROUP_LIFT * member;
  }
  return { top, bottom, height: top + bottom };
}

/** Usable sky ends at the treetops, even if that leaves less space than the ground boundary. */
export const walkerSkyFloor = (viewport: WalkerViewport) => Math.max(0, Math.min(viewport.height - viewport.ground, viewport.skyFloor ?? viewport.height - viewport.ground));
/**
 * La franja de arriba del pasto, pegada al agua, donde los de suelo no caminan: sus pies quedaban tan cerca del río que se veían raros.
 * Un 15 % del alto del pasto, y nunca menos de dos rem (ni más de un cuarto del pasto).
 */
export const groundTopMargin = (viewport: Pick<WalkerViewport, 'ground' | 'rem'>) => Math.min(0.25 * viewport.ground, Math.max(0.15 * viewport.ground, 2 * viewport.rem));
/** El río: el del fondo de la escena, o (sin medirlo) una franja sobre el pasto con la proporción del dibujo. */
export function waterBand(viewport: WalkerViewport): { top: number; bottom: number } {
  if (viewport.water) return viewport.water;
  const bottom = viewport.height - viewport.ground - 0.06 * viewport.ground;
  return { top: bottom - 0.4 * viewport.ground, bottom };
}
/** Profundidad de los nadadores: del fondo del río (arriba) a la orilla (abajo); por debajo de los de suelo (100 en adelante). */
export const WATER_DEPTH_MIN = 20;
export const WATER_DEPTH_MAX = 80;
/** Cuánto del cuerpo de un nadador queda bajo el agua, como fracción de su alto. */
export const SUBMERGE = 0.35;
/** Hasta dónde puede subir el cuerpo de un nadador: dos veces y media la altura del río sobre su orilla (un Kyogre asoma por encima del agua). */
export function waterCeiling(viewport: WalkerViewport): number {
  const band = waterBand(viewport);
  return Math.max(0, band.bottom - 2.5 * (band.bottom - band.top));
}
export const walkerVerticalArea = (pokemon: WalkerPokemon, viewport: WalkerViewport) => pokemon.zone === 'sky' ? walkerSkyFloor(viewport)
  : pokemon.zone === 'water' ? Math.max(0, waterBand(viewport).bottom - waterCeiling(viewport)) : viewport.height - walkerSkyFloor(viewport);

export function walkerTargetHeight(pokemon: WalkerPokemon, variant: WalkerVariant, viewport: WalkerViewport): number {
  const mobile = compactWalkers(viewport.width, viewport.height, viewport.rem);
  const sky = pokemon.zone === 'sky';
  const unit = mobile ? 1 : viewport.rem / 16;
  // Cada miembro de un grupo es pequeño: seis juntos ya ocupan mucho ancho, así que su piso de legibilidad es menor.
  const minimum = (sky ? mobile ? 36 : 56 : mobile ? 48 : 72) * unit * (pokemon.group ? 0.65 : 1);
  const maximum = (sky ? mobile ? 144 : 256 : mobile ? 176 : 320) * unit;
  const area = walkerVerticalArea(pokemon, viewport);
  // Un grupo entero tiene que caber en el pasto (miembro + tope arriba y abajo): con el pasto bajo, los miembros se achican.
  const grass = pokemon.group && !sky ? Math.max(1, (viewport.ground - 2 * viewport.rem) / (1 + 2 * GROUP_LIFT)) : Infinity;
  const budget = Math.max(1, Math.min(maximum, area - 2 * viewport.rem));
  const compression = Math.min(1, budget / maximum);
  const native = Math.max(...Object.values(variant.animations.Walk.directions).map((sheet) => sheet.bbox.height));
  const height = pokemon.heightMeters === undefined ? undefined : pokemon.heightMeters * (pokemon.elongated ? 0.4 : 1);
  const desired = height !== undefined
    ? (sky ? mobile ? 62 : 104 : mobile ? 76 : 125) * unit * height ** 0.7 * compression
    : native * Math.max(1, viewport.artPixel / 2);
  return Math.min(budget, grass, Math.max(minimum * compression, desired));
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
  for (const occupied of viewport.occupiedLanes ?? []) separated = subtractIntervals(separated, [occupied - (viewport.laneGap ?? viewport.rem), occupied + (viewport.laneGap ?? viewport.rem)]);
  if (separated.length) intervals = separated;
  const total = intervals.reduce((sum, [lo, hi]) => sum + hi - lo, 0);
  let distance = Math.max(0, Math.min(1, random())) * total;
  for (const [lo, hi] of intervals) {
    if (distance <= hi - lo) return { feetY: lo + distance, available: true };
    distance -= hi - lo;
  }
  return { feetY: intervals.at(-1)![1], available: true };
}

export function planWalker(pokemon: WalkerPokemon, viewport: WalkerViewport, random: () => number, options: { shiny?: boolean; direction?: WalkerDirection; formation?: FormationKind; /** Velocidad fija en rem/s (los eventos). */ speedRem?: number; /** Franja del cielo (de 0 a 1 del alto libre) donde puede volar; solo para voladores. */ band?: readonly [number, number]; /** Sale este tanto más atrás de lo normal (px). */ behind?: number; /** Pies en esta altura de la pantalla (px), ajustada a lo que cabe: solo suelo. */ feetY?: number } = {}): WalkerPlan {
  const shiny = Boolean(pokemon.variants.shiny && (options.shiny ?? random() < 1 / SHINY_ODDS));
  const variant = shiny ? pokemon.variants.shiny! : pokemon.variants.normal;
  const direction = options.direction ?? (random() < 0.5 ? 'east' : 'west');
  const scale = walkerScale(pokemon, variant, viewport);
  const margin = Math.max(...Object.values(variant.animations).map((animation) => animation.directions[direction].frameWidth)) * scale;
  const walkSheets = Object.values(locomotionAnimation(pokemon, variant).directions);
  let formation: WalkerFormation | undefined;
  if (pokemon.group) {
    const kind = options.formation ?? FORMATION_KINDS[Math.min(FORMATION_KINDS.length - 1, Math.max(0, Math.floor(random() * FORMATION_KINDS.length)))];
    const unitW = Math.max(...walkSheets.map((sheet) => sheet.bbox.width)) * scale, unitH = Math.max(...walkSheets.map((sheet) => sheet.bbox.height)) * scale;
    const seeds = Array.from({ length: pokemon.group.count }, () => Math.min(0.999, Math.max(0, random())));
    formation = { kind, seeds, unitW, unitH, span: formationSpan(kind, pokemon.group.count, unitW) };
  }
  // El grupo sale del todo recién cuando su último miembro cruzó el borde.
  const trail = formation?.span ?? 0;
  const start = direction === 'east' ? -margin : viewport.width + margin;
  const end = direction === 'east' ? viewport.width + margin + trail : -margin - trail;
  const speed = options.speedRem !== undefined ? options.speedRem * viewport.rem
    : (pokemon.movement === 'run' ? 7 : pokemon.zone === 'sky' ? 4 : 3.5) * viewport.rem * (0.9 + random() * 0.2);
  const extents = walkerExtents(pokemon, variant, scale, viewport.rem);
  const padding = viewport.rem * 0.5;
  const groundTop = viewport.height - viewport.ground;
  // Suelo y agua caminan por carriles (el suelo, en el pasto; el agua, en el río); solo el cielo no.
  const onLane = pokemon.zone !== 'sky', water = pokemon.zone === 'water', band = waterBand(viewport);
  const laneTop = water ? band.top : groundTop, laneBottom = water ? band.bottom : viewport.height;
  const locomotion = locomotionAnimation(pokemon, variant);
  const visibleHeight = Math.max(...Object.values(locomotion.directions).map((sheet) => sheet.bbox.height)) * scale * (formation ? 1 + 2 * GROUP_LIFT : 1);
  const walking = locomotion.directions[direction];
  const walkingBottom = (walking.bbox.y + walking.bbox.height - walking.anchor.y) * scale;
  // Nadador: `feetY` es la línea de flotación; el cuerpo sigue por debajo (sumergido) y el dibujo lo recorta ahí.
  const submerge = water ? (pokemon.submergeFraction ?? SUBMERGE) * visibleHeight : 0;
  // Los pies de TODOS los miembros pisan el pasto: el más alto de la formación no puede quedar sobre el agua.
  // La marea (`drift`) sube y baja un rem: aun así los pies quedan dentro del carril.
  const grassTop = laneTop + (water ? 0 : groundTopMargin(viewport)) + padding + (formation ? GROUP_LIFT * formation.unitH : 0) + (onLane && pokemon.movement === 'drift' ? viewport.rem : 0);
  // Los de LAKE_LOW_LANE (Kyogre) solo nadan por la mitad de abajo del río: más arriba parecería volar sobre el agua.
  const lowOnly = water && LAKE_LOW_LANE.includes(pokemon.entityId) ? laneTop + 0.6 * (laneBottom - laneTop) : 0;
  const lowFeet = Math.max(grassTop, lowOnly, (water ? waterCeiling(viewport) : walkerSkyFloor(viewport)) + padding + extents.top + walkingBottom - submerge);
  const highFeet = water ? laneBottom - padding : laneBottom - padding - extents.bottom + walkingBottom;
  let selected = onLane
    ? lowFeet <= highFeet ? chooseGroundLane(lowFeet, highFeet, visibleHeight, viewport, random) : { feetY: lowFeet, available: false }
    : { feetY: 0, available: extents.height + 2 * padding <= walkerSkyFloor(viewport) };
  if (onLane && options.feetY !== undefined && lowFeet <= highFeet) {
    // Carril pedido por un evento: si queda tapado por las tarjetas o el pie, se sortea uno libre como siempre.
    const wanted = chooseGroundLane(Math.min(highFeet, Math.max(lowFeet, options.feetY)), Math.min(highFeet, Math.max(lowFeet, options.feetY)), visibleHeight, viewport, random);
    if (wanted.available) selected = wanted;
  }
  const y = pokemon.zone === 'sky'
    ? extents.top + padding + (options.band ? options.band[0] + random() * (options.band[1] - options.band[0]) : random()) * Math.max(0, walkerSkyFloor(viewport) - 2 * padding - extents.height)
    : selected.feetY + submerge - walkingBottom;
  const lane = onLane ? (selected.feetY - laneTop) / Math.max(1, laneBottom - laneTop) : 0;
  const plan: WalkerPlan = { pokemon, variant, shiny, direction, scale, speed, ...(formation ? { formation } : {}), ...(water ? { submerge } : {}),
    feetY: onLane ? selected.feetY : y + extents.bottom,
    // Más arriba en el río = más lejos: tapado por los de más abajo, sin importar quién apareció primero. Siempre detrás del pasto (100+).
    lane, depth: water ? WATER_DEPTH_MIN + Math.round(Math.max(0, Math.min(1, lane)) * (WATER_DEPTH_MAX - WATER_DEPTH_MIN)) : onLane ? 100 + Math.round(lane * 1000) : 10,
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
  // Más atrás de la entrada normal: el mismo ritmo, pero llega después (y sale después).
  plan.start += (direction === 'east' ? -1 : 1) * Math.max(0, options.behind ?? 0);
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
  // Sin la franja de arriba del pasto (pegada al agua), igual que los que caminan.
  const bounds = burrowBounds(plan, viewport.rem), groundTop = viewport.height - viewport.ground + groundTopMargin(viewport);
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
    const separated = !viewport.occupiedLanes?.some(lane => Math.abs(lane - feetY) < (viewport.laneGap ?? viewport.rem));
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

/** Puestos de un grupo en pantalla, relativos al líder: `dx` ya lleva el signo según hacia dónde camina. */
export function groupSlots(plan: WalkerPlan, travelMs: number): { dx: number; dy: number }[] {
  const group = plan.pokemon.group;
  if (!group || !plan.formation) return [];
  const sign = plan.direction === 'east' ? -1 : 1;
  return formationSlots(plan.formation, group.count, travelMs / 1000).map((slot) => ({ dx: sign * slot.back, dy: slot.lift }));
}

/** El actor salió del todo de la escena: para un grupo cuenta el último miembro, no el líder. */
export function walkerLeftScene(plan: WalkerPlan, x: number, viewportWidth: number): boolean {
  if (plan.pokemon.burrow) return false;
  const walk = locomotionAnimation(plan.pokemon, plan.variant).directions[plan.direction];
  const left = x + (walk.bbox.x - walk.anchor.x) * plan.scale, right = left + walk.bbox.width * plan.scale, trail = plan.formation?.span ?? 0;
  return plan.direction === 'east' ? left - trail >= viewportWidth : right + trail <= 0;
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

import type { Entity } from '../../../src/engine/types.ts';

export const PMD_SNAPSHOT = 'a966728683def4f4df3c51ef7dea53e271dcfd7a';
// SpriteBot/SpriteUtils.py animateFileZip: durations[jj] * 20 (not 60 Hz).
export const PMD_TICK_MS = 20;
// SpriteBot/Constants.py DIRECTIONS: Down, DownRight, Right, ..., Left, DownLeft.
export const PMD_DIRECTIONS = { east: 2, west: 6 } as const;
export type Direction = keyof typeof PMD_DIRECTIONS;
export interface Box { x: number; y: number; width: number; height: number }
export interface Animation {
  name: string;
  copyOf?: string;
  width?: number;
  height?: number;
  ticks: number[];
}
export interface AnimData { shadowSize: number; animations: Map<string, Animation> }

/** Small parser for the upstream AnimData dialect; never expands XML entities. */
export function parseAnimData(xml: string): AnimData {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<AnimData>/.test(xml)) throw new Error('AnimData XML inválido');
  const animations = new Map<string, Animation>();
  for (const match of xml.matchAll(/<Anim>\s*([\s\S]*?)\s*<\/Anim>/g)) {
    const body = match[1];
    const tag = (name: string) => body.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1].trim();
    const name = tag('Name');
    const copyOf = tag('CopyOf');
    if (!name || !/^[A-Za-z0-9_-]+$/.test(name) || animations.has(name)) throw new Error('Nombre de animación inválido o repetido');
    const ticks = [...body.matchAll(/<Duration>([^<]*)<\/Duration>/g)].map((entry) => Number(entry[1]));
    const width = Number(tag('FrameWidth'));
    const height = Number(tag('FrameHeight'));
    if (!copyOf && (![width, height, ...ticks].every((n) => Number.isInteger(n) && n > 0) || !ticks.length)) {
      throw new Error(`Medidas/duraciones inválidas: ${name}`);
    }
    animations.set(name, { name, copyOf, width: copyOf ? undefined : width, height: copyOf ? undefined : height, ticks });
  }
  const shadowSize = Number(xml.match(/<ShadowSize>(\d+)<\/ShadowSize>/)?.[1]);
  if (!animations.size || !Number.isInteger(shadowSize)) throw new Error('AnimData incompleto');
  return { shadowSize, animations };
}

export function resolveAnimation(data: AnimData, name: string): Required<Omit<Animation, 'copyOf'>> | null {
  const visited = new Set<string>();
  let current = data.animations.get(name);
  if (!current) return null;
  while (current.copyOf) {
    if (visited.has(current.name)) throw new Error(`Ciclo CopyOf: ${name}`);
    visited.add(current.name);
    const next = data.animations.get(current.copyOf);
    if (!next) throw new Error(`CopyOf inexistente: ${current.copyOf}`);
    current = next;
  }
  return { name: current.name, width: current.width!, height: current.height!, ticks: current.ticks };
}

/** A sleep pose is required; Idle/Eat alone must not be mislabelled as sleeping. */
export function sleepRecipe(data: AnimData) {
  const first = (names: string[]) => names.find((name) => resolveAnimation(data, name)) ?? null;
  const sleep = first(['Sleep', 'Rest', 'Laying', 'Lie']);
  if (!sleep) return null;
  const wake = first(['Wake', 'WakeUp', 'GetUp', 'StandUp', 'Idle']);
  if (!wake) return null;
  const laying = first(['Laying', 'Lie']);
  const enter = laying && resolveAnimation(data, laying)?.name !== resolveAnimation(data, sleep)?.name ? laying : null;
  return { enter, sleep, wake };
}

export function directionCrop(width: number, height: number, animation: { width: number; height: number; ticks: number[] }, direction: Direction) {
  const rows = height / animation.height;
  if (![1, 8].includes(rows) || width !== animation.width * animation.ticks.length) throw new Error('Hoja no coincide con AnimData');
  const sourceRow = rows === 1 ? 0 : PMD_DIRECTIONS[direction];
  return { left: 0, top: sourceRow * animation.height, width, height: animation.height, sourceRow, sourceRows: rows };
}

/** Bounding box in local frame coordinates, including partially transparent pixels. */
export function opaqueBounds(rgba: Uint8Array, sheetWidth: number, frame: Box): Box | null {
  let left = frame.width, top = frame.height, right = -1, bottom = -1;
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    if (rgba[((y + frame.y) * sheetWidth + x + frame.x) * 4 + 3] > 0) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function normalizedName(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function mapPokemonName(name: string, entities: readonly Entity[]) {
  const alola = name === 'Exeggutor de Alola';
  const key = normalizedName(alola ? 'Exeggutor' : name);
  const matches = entities.filter((entity) => [entity.id, ...Object.values(entity.name), ...entity.aliases].some((s) => normalizedName(s) === key));
  if (matches.length !== 1) throw new Error(`Nombre PMD ambiguo o inexistente: ${name}`);
  const entity = matches[0];
  const number = entity.attrs.numero;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) throw new Error(`Número inválido: ${name}`);
  return { entityId: entity.id, number, dex: String(number).padStart(4, '0'), form: alola ? 'alola' : 'base' };
}

export const PMD_PORTRAIT_EMOTIONS = { normal: 'Normal', happy: 'Happy', sad: 'Sad' } as const;
export type PortraitEmotion = keyof typeof PMD_PORTRAIT_EMOTIONS;
export const portraitUrl = (number: number, emotion: PortraitEmotion = 'normal') => `/img/pokemon/pmd/${String(number).padStart(4, '0')}/${emotion}.png`;

/** Separate emotion index: adding future portraits never changes the game entity. */
export function buildPortraitIndex(entries: readonly { number: number; entityId: string; emotions: Record<PortraitEmotion, string | null> }[]) {
  const portraits: Record<string, { entityId: string } & Record<PortraitEmotion, string | null>> = {};
  const available: Record<PortraitEmotion, number> = { normal: 0, happy: 0, sad: 0 };
  const missing: Record<PortraitEmotion, number[]> = { normal: [], happy: [], sad: [] };
  for (const entry of [...entries].sort((a, b) => a.number - b.number)) {
    const dex = String(entry.number).padStart(4, '0');
    if (!Number.isInteger(entry.number) || entry.number < 1 || portraits[dex]) throw new Error('Número de retrato inválido o repetido');
    portraits[dex] = { entityId: entry.entityId, ...entry.emotions };
    for (const emotion of Object.keys(PMD_PORTRAIT_EMOTIONS) as PortraitEmotion[]) {
      if (entry.emotions[emotion]) available[emotion]++;
      else missing[emotion].push(entry.number);
    }
  }
  return { portraits, available, missing };
}
export function withPmdPortraits(entities: readonly Entity[], available: ReadonlySet<number>): Entity[] {
  return entities.map((entity) => ({ ...entity, attrs: { ...entity.attrs, pmdPortrait: typeof entity.attrs.numero === 'number' && available.has(entity.attrs.numero) ? portraitUrl(entity.attrs.numero) : null } }));
}

export interface Artist { id: string; name: string; contact: string }
export interface Credit { artistId: string; date: string; status: string; sourceLicense: string; contributions: string[] }
export interface SpriteCredit { primary: string; secondary: string[]; total: number }
export const artistId = (id: string) => id.replace(/^<@!?(\d+)>$/, '$1');
export function parseArtistNames(tsv: string): Map<string, Artist> {
  const artists = new Map<string, Artist>();
  for (const line of tsv.replace(/^\uFEFF/, '').split(/\r?\n/).slice(1).filter(Boolean)) {
    const [name, rawId, contact = ''] = line.split('\t');
    if (!rawId) throw new Error('Registro de artista sin ID');
    const id = artistId(rawId);
    artists.set(id, { id, name: name || artists.get(id)?.name || id, contact: contact || artists.get(id)?.contact || '' });
  }
  return artists;
}

export function parseCredits(tsv: string): Credit[] {
  return tsv.split(/\r?\n/).filter(Boolean).map((line) => {
    const [date, id, status, sourceLicense, actions = ''] = line.split('\t');
    if (!date || !id || !status || !sourceLicense) throw new Error('credits.txt inválido');
    return { artistId: artistId(id), date, status, sourceLicense, contributions: actions.split(',').map((s) => s.trim()).filter(Boolean) };
  });
}

/** Keep matching historical coauthors too; retain their status and license verbatim. */
export function creditsFor(credits: readonly Credit[], actions: readonly string[]): Credit[] {
  const matches = credits.filter((credit) => !credit.contributions.length || credit.contributions.includes('Unspecified') || actions.some((action) => credit.contributions.includes(action)));
  if (!matches.length) throw new Error(`Faltan créditos para ${actions.join('/')}`);
  return matches;
}

/** A new form credits its tracker authors too, retaining actual TSV records/licenses. */
export function creditsForForm(credits: readonly Credit[], actions: readonly string[], tracker: SpriteCredit): Credit[] {
  const matching = creditsFor(credits, actions);
  const ids = [tracker.primary, ...tracker.secondary].filter(Boolean).map(artistId);
  for (const id of ids) if (!credits.some(credit => credit.artistId === id)) throw new Error(`Autor del tracker sin credits.txt: ${id}`);
  return [...new Set([...matching, ...credits.filter(credit => ids.includes(credit.artistId))])];
}

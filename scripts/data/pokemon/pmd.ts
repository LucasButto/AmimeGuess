// npm run data:pokemon-pmd — only PMD resources from the approved immutable snapshot.
import { mkdir, readFile, rename, stat, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Entity } from '../../../src/engine/types.ts';
import { ROOT, mapPool } from './api.ts';
import {
  PMD_SNAPSHOT, PMD_TICK_MS, PMD_DIRECTIONS, parseAnimData, resolveAnimation,
  mapPokemonName, parseArtistNames, parseCredits, creditsFor, portraitUrl,
  PMD_PORTRAIT_EMOTIONS, buildPortraitIndex,
  sleepRecipe, creditsForForm,
  type Artist, type Credit, type Direction, type PortraitEmotion, type SpriteCredit,
} from './pmd-core.ts';
import { PMD_REQUESTED, PMD_EXCLUDED, PMD_GALAR, PMD_SERPENTINES, PMD_FORM_HEIGHTS, presentationFor } from './pmd-roster.ts';
import { generateSizeFactors, SIZE_VIEWPORT } from './pmd-sizing.ts';
import type { WalkerPokemon } from '../../../src/franchises/pokemon/theme/walkerMotion.ts';
import { processDirection, processPortrait, processShadow, sha256 } from './pmd-images.ts';
import { attachPmdPortraits } from './pmd-portraits.ts';
import { entitySchema } from './schemas.ts';

const RAW = `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/${PMD_SNAPSHOT}/`;
const CACHE = path.join(ROOT, 'data-src/pokemon/pmd', PMD_SNAPSHOT);
const PUBLIC = path.join(ROOT, 'public');
const ASSETS = '/theme/pokemon/pmd';
const ENTITIES = path.join(ROOT, 'data/pokemon/entities.json');
const SOURCE_INDEX = path.join(CACHE, 'source-index.json');
const CONCURRENCY = 3;
interface TrackerNode {
  name: string;
  sprite_files: Record<string, boolean>;
  portrait_files: Record<string, boolean>;
  subgroups: Record<string, TrackerNode>;
  sprite_credit: SpriteCredit;
}
interface Source { url: string; sha256: string; bytes: number }
interface Resource {
  id: string; kind: 'sprite' | 'portrait'; source: Source; creditSource: Source;
  outputs: string[]; contributions: Credit[];
  trackerCredit?: SpriteCredit;
}
interface ProcessedAnimation {
  sourceAnimation: string;
  source: Source;
  creditId: string;
  directions: Partial<Record<Direction, Awaited<ReturnType<typeof processDirection>>['metadata'] & { url: string; sha256: string; bytes: number }>>;
  shadow?: { source: Source; creditId: string; directions: ProcessedAnimation['directions'] };
}
const sources: Record<string, Source> = {};
const resources: Resource[] = [];
const artists = new Map<string, Artist>();
let nextRequest = 0, downloaded = 0, hits = 0, auditImports = 0, stopped = false;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function writeChanged(file: string, data: Buffer | string): Promise<void> {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  try { if ((await readFile(file)).equals(buffer)) return; } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, buffer);
  await rename(temporary, file);
}
const writeJson = (file: string, value: unknown) => writeChanged(file, `${JSON.stringify(value, null, 2)}\n`);

/** Three workers at most, ≤10 request starts/s, Retry-After and atomic persistent cache. */
async function sourceFile(relative: string): Promise<Buffer> {
  if (stopped) throw new Error('Descarga detenida tras un error anterior');
  if (!/^[A-Za-z0-9_./-]+$/.test(relative) || relative.split('/').includes('..')) throw new Error('Ruta upstream inválida');
  const file = path.join(CACHE, relative);
  let data: Buffer;
  try {
    data = await readFile(file);
    if (!data.length || (sources[relative] && sources[relative].sha256 !== sha256(data))) throw new Error(`Caché corrupta: ${file}`);
    hits++;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    // Read-only reuse of the pinned, reviewed audit cache; copy only requested resources.
    try {
      data = await readFile(path.join(ROOT, '.cache/pmd-vuelo/raw', relative));
      if (!data.length || (sources[relative] && sources[relative].sha256 !== sha256(data))) throw new Error(`Caché auditada corrupta: ${relative}`);
      await writeChanged(file, data);
      sources[relative] = { url: RAW + relative, sha256: sha256(data), bytes: data.length };
      auditImports++;
      return data;
    } catch (auditError) {
      if ((auditError as NodeJS.ErrnoException).code !== 'ENOENT') throw auditError;
    }
    let lastError: unknown;
    data = Buffer.alloc(0);
    for (let attempt = 0; attempt < 5; attempt++) {
      const start = Math.max(Date.now(), nextRequest);
      nextRequest = start + 100;
      await sleep(Math.max(0, start - Date.now()));
      if (stopped) throw new Error('Descarga detenida');
      let retryDelay = 1000 * 2 ** attempt;
      try {
        const response = await fetch(RAW + relative, {
          headers: { 'User-Agent': 'AnimeGuess-PMD-data (non-commercial audit)' }, signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) retryDelay = Math.max(retryDelay, /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now());
          await response.body?.cancel();
          if (response.status !== 429 && response.status < 500) throw new Error(`HTTP definitivo ${response.status}: ${RAW + relative}`);
          throw new Error(`HTTP ${response.status}: ${RAW + relative}`);
        }
        const received = Buffer.from(await response.arrayBuffer());
        if (!received.length) throw new Error(`Respuesta vacía: ${relative}`);
        await writeChanged(file, received);
        data = received;
        downloaded++;
        break;
      } catch (error) {
        lastError = error;
        if (error instanceof Error && error.message.startsWith('HTTP definitivo')) break;
        if (attempt < 4) await sleep(retryDelay);
      }
    }
    if (!data.length) { stopped = true; throw new Error(`No se pudo descargar ${relative}: ${String(lastError)}`); }
  }
  sources[relative] = { url: RAW + relative, sha256: sha256(data), bytes: data.length };
  return data;
}

function resourceCredit(id: string, kind: Resource['kind'], sourcePath: string, creditsPath: string, records: Credit[], actions: string[], outputs: string[], trackerCredit?: SpriteCredit) {
  const contributions = trackerCredit ? creditsForForm(records, actions, trackerCredit) : creditsFor(records, actions);
  resources.push({ id, kind, source: sources[sourcePath], creditSource: sources[creditsPath], outputs, contributions, ...(trackerCredit ? { trackerCredit } : {}) });
  for (const credit of contributions) if (!artists.has(credit.artistId)) {
    // Preserve an upstream ID even if it has no public display name/contact.
    artists.set(credit.artistId, { id: credit.artistId, name: credit.artistId, contact: '' });
  }
}

async function variant(directory: string, outputDirectory: string, decision: ReturnType<typeof presentationFor>, node: TrackerNode, optional = false) {
  const xmlPath = `sprite/${directory}/AnimData.xml`, creditsPath = `sprite/${directory}/credits.txt`;
  const data = parseAnimData((await sourceFile(xmlPath)).toString('utf8'));
  const records = parseCredits((await sourceFile(creditsPath)).toString('utf8'));
  const burrow = decision.movement === 'burrow';
  const required = ['Walk', decision.locomotion, ...(burrow ? ['DigIn', 'Idle', 'DigOut'] : [])];
  if (required.some(name => !resolveAnimation(data, name))) {
    if (optional) return null;
    throw new Error(`${directory}: faltan acciones ${required.join('/')}`);
  }
  const preserve = !decision.sourceForm; // Keep legacy actions, paths and hashes for unchanged forms.
  const interactive = !burrow && (decision.zone === 'ground' || preserve);
  const hit = interactive ? resolveAnimation(data, 'HitGround') : null;
  const sleep = interactive ? sleepRecipe(data) : null;
  const names = [...new Set([...required, ...(hit ? ['HitGround', 'Idle'] : []),
    ...(sleep ? [sleep.enter, sleep.sleep, sleep.wake].filter((name): name is string => name !== null) : [])])];
  const animations: Record<string, ProcessedAnimation> = {};
  const usedSheets = new Map<string, Buffer>();
  for (const name of names) {
    const animation = resolveAnimation(data, name);
    if (!animation) throw new Error(`${directory}: falta ${name}`);
    const sourcePath = `sprite/${directory}/${animation.name}-Anim.png`;
    let sheet = usedSheets.get(sourcePath);
    if (!sheet) { sheet = await sourceFile(sourcePath); usedSheets.set(sourcePath, sheet); }
    const creditId = `sprite/${directory}/${name}`;
    const directions: ProcessedAnimation['directions'] = {};
    const selection = name === decision.locomotion && decision.locomotionFrames
      ? { indices: decision.locomotionFrames, durationMs: decision.locomotionFrameMs! } : undefined;
    const durationFactor = name === decision.locomotion ? decision.locomotionDurationFactor ?? 1 : 1;
    const referenceAnimation = name === decision.locomotion && decision.locomotionSizeReference
      ? resolveAnimation(data, decision.locomotionSizeReference) : null;
    if (name === decision.locomotion && decision.locomotionSizeReference && !referenceAnimation) throw new Error('Falta referencia de escala aprobada');
    for (const direction of Object.keys(PMD_DIRECTIONS) as Direction[]) {
      const result = await processDirection(sheet, animation, direction, selection, durationFactor);
      if (referenceAnimation) {
        const reference = await processDirection(await sourceFile(`sprite/${directory}/${referenceAnimation.name}-Anim.png`), referenceAnimation, direction);
        result.metadata.referenceBbox = reference.metadata.bbox;
      }
      const url = `${ASSETS}/sprites/${outputDirectory}/${name === 'HitGround' ? 'hit-ground' : name.toLowerCase()}-${direction}.webp`;
      await writeChanged(path.join(PUBLIC, url), result.image);
      directions[direction] = { ...result.metadata, url, sha256: sha256(result.image), bytes: result.image.length };
    }
    const trackerCredit = decision.sourceForm ? node.sprite_credit : undefined;
    resourceCredit(creditId, 'sprite', sourcePath, creditsPath, records, [name, animation.name], Object.values(directions).map((d) => d.url), trackerCredit);
    const processed: ProcessedAnimation = { sourceAnimation: animation.name, source: sources[sourcePath], creditId, directions };
    if ((decision.zone === 'sky' && name === decision.locomotion) || (burrow && ['DigIn', 'Idle', 'DigOut'].includes(name))) {
      const shadowPath = `sprite/${directory}/${animation.name}-Shadow.png`;
      const shadow = await sourceFile(shadowPath);
      const shadowDirections: ProcessedAnimation['directions'] = {};
      for (const direction of Object.keys(PMD_DIRECTIONS) as Direction[]) {
        const result = await processShadow(shadow, animation, direction, data.shadowSize, selection, durationFactor);
        const url = `${ASSETS}/sprites/${outputDirectory}/${name.toLowerCase()}-shadow-${direction}.webp`;
        await writeChanged(path.join(PUBLIC, url), result.image);
        shadowDirections[direction] = { ...result.metadata, url, sha256: sha256(result.image), bytes: result.image.length };
      }
      const shadowCreditId = creditId + '/shadow';
      resourceCredit(shadowCreditId, 'sprite', shadowPath, creditsPath, records, [name, animation.name], Object.values(shadowDirections).map(d => d.url), trackerCredit);
      processed.shadow = { source: sources[shadowPath], creditId: shadowCreditId, directions: shadowDirections };
    }
    animations[name] = processed;
  }
  return { hasHitGround: Boolean(hit), recovery: hit ? 'Idle' : null, sleep, shadowSize: data.shadowSize, metadataSource: sources[xmlPath], ...(decision.sourceForm ? { spriteCredit: node.sprite_credit } : {}), animations };
}

async function directoryBytes(dir: string): Promise<number> {
  let bytes = 0;
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    bytes += item.isDirectory() ? await directoryBytes(file) : (await stat(file)).size;
  }
  return bytes;
}

async function main() {
  try { Object.assign(sources, JSON.parse(await readFile(SOURCE_INDEX, 'utf8'))); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const entities: Entity[] = JSON.parse(await readFile(ENTITIES, 'utf8'));
  entities.forEach((entity) => entitySchema.parse(entity));
  const tracker: Record<string, TrackerNode> = JSON.parse((await sourceFile('tracker.json')).toString('utf8'));
  const names = parseArtistNames((await sourceFile('credit_names.txt')).toString('utf8'));
  await sourceFile('LICENSE.md');
  const selected: { name: string; zone: 'sky' | 'ground'; baseName?: string; entityId?: string }[] = [...PMD_REQUESTED.filter((entry) => !PMD_EXCLUDED.has(entry.name)), ...PMD_GALAR];
  console.log(`PMD ${PMD_SNAPSHOT}: ${selected.length} caminantes; ${entities.length} especies × Normal/Happy/Sad. Concurrencia ${CONCURRENCY}.`);
  let complete = 0;
  const pokemon = await mapPool(selected, CONCURRENCY, async (entry) => {
    try {
      const mapped = mapPokemonName(entry.baseName ?? entry.name, entities);
      const decision = presentationFor(entry.name, entry.zone);
      const baseNode = tracker[mapped.dex];
      let directory = mapped.dex, node = baseNode;
      if (mapped.form === 'alola') {
        const form = Object.entries(baseNode.subgroups).find(([, form]) => form.name === 'Alola');
        if (!form) throw new Error('Falta forma Alola');
        directory += `/${form[0]}`; node = form[1];
      }
      if (decision.sourceForm) {
        directory = `${mapped.dex}/${decision.sourceForm}`;
        node = baseNode.subgroups[decision.sourceForm];
        if (!node) throw new Error(`Falta forma aprobada ${directory}`);
      }
      const outputForm = decision.form ?? mapped.form;
      const normal = await variant(directory, `${mapped.dex}/${outputForm}/normal`, decision, node);
      if (!normal) throw new Error('Falta variante normal');
      const nested = Boolean(decision.sourceForm || mapped.form === 'alola');
      const shinyNode = nested ? node.subgroups['0001'] : node.subgroups['0000']?.subgroups['0001'];
      const shinyDirectory = nested ? `${directory}/0001` : `${directory}/0000/0001`;
      let shiny = shinyNode && Object.keys(shinyNode.sprite_files).length
        ? await variant(shinyDirectory, `${mapped.dex}/${outputForm}/shiny`, decision, shinyNode, true) : null;
      if (!shiny && decision.form === 'altcolor') {
        // El Altcolor sin variocolor propio usa el variocolor normal (decisión del usuario).
        const baseShiny = baseNode.subgroups['0000']?.subgroups['0001'];
        if (baseShiny && Object.keys(baseShiny.sprite_files).length)
          shiny = await variant(`${mapped.dex}/0000/0001`, `${mapped.dex}/${outputForm}/shiny`, decision, baseShiny, true);
      }
      if (++complete % 25 === 0) console.log(`Caminantes ${complete}/${selected.length}; red ${downloaded}, caché ${hits}`);
      return { ...mapped, entityId: entry.entityId ?? mapped.entityId, form: outputForm, name: entry.name, zone: decision.zone, movement: decision.movement, locomotion: decision.locomotion,
        ...(Object.hasOwn(PMD_SERPENTINES, entry.entityId ?? mapped.entityId) ? { elongated: true } : {}),
        ...(PMD_FORM_HEIGHTS[entry.entityId ?? mapped.entityId] ? { formHeightMeters: PMD_FORM_HEIGHTS[entry.entityId ?? mapped.entityId] } : {}),
        ...(decision.locomotionFrames ? { locomotionFrames: decision.locomotionFrames, locomotionFrameMs: decision.locomotionFrameMs } : {}),
        ...(decision.locomotionBob ? { locomotionBob: decision.locomotionBob } : {}),
        ...(decision.locomotionDurationFactor ? { locomotionDurationFactor: decision.locomotionDurationFactor } : {}),
        ...(decision.movement === 'burrow' ? { burrow: { emerge: 'DigIn', idle: 'Idle', hide: 'DigOut' } } : {}), variants: { normal, shiny } };
    } catch (error) { stopped = true; throw new Error(`${entry.name}: ${String(error)}`); }
  });
  if (new Set(pokemon.map(p => p.entityId)).size !== pokemon.length || PMD_GALAR.some(p => entities.some(entity => entity.id === p.entityId))) throw new Error('Colisión de IDs PMD');
  const sizing = await generateSizeFactors(pokemon as unknown as WalkerPokemon[], entities, PUBLIC);
  complete = 0;
  const portraitResults = await mapPool(entities, CONCURRENCY, async (entity) => {
    try {
      const number = entity.attrs.numero as number, dex = String(number).padStart(4, '0');
      if (!Object.hasOwn(tracker[dex].portrait_files, 'Normal')) throw new Error('Falta retrato Normal aprobado');
      const creditPath = `portrait/${dex}/credits.txt`;
      const records = parseCredits((await sourceFile(creditPath)).toString('utf8'));
      const emotions: Record<PortraitEmotion, string | null> = { normal: null, happy: null, sad: null };
      let normal = null;
      for (const emotion of Object.keys(PMD_PORTRAIT_EMOTIONS) as PortraitEmotion[]) {
        const upstreamName = PMD_PORTRAIT_EMOTIONS[emotion];
        // The pinned tracker records actual emotions by key; false means unlocked, not absent.
        if (!Object.hasOwn(tracker[dex].portrait_files, upstreamName)) continue;
        const sourcePath = `portrait/${dex}/${upstreamName}.png`;
        const image = await processPortrait(await sourceFile(sourcePath));
        const url = portraitUrl(number, emotion), creditId = `portrait/${dex}/${upstreamName}`;
        await writeChanged(path.join(PUBLIC, url), image);
        resourceCredit(creditId, 'portrait', sourcePath, creditPath, records, [upstreamName], [url]);
        emotions[emotion] = url;
        if (emotion === 'normal') normal = { entityId: entity.id, number, url, width: 40, height: 40, bytes: image.length, sha256: sha256(image), source: sources[sourcePath], creditId };
      }
      if (!normal) throw new Error('Falta retrato Normal procesado');
      if (++complete % 100 === 0) console.log(`Retratos ${complete}/${entities.length}; red ${downloaded}, caché ${hits}`);
      return { normal, number, entityId: entity.id, emotions };
    } catch (error) { stopped = true; throw new Error(`${entity.id}: ${String(error)}`); }
  });
  const portraits = portraitResults.map((entry) => entry.normal);
  const portraitIndexUrl = '/img/pokemon/pmd/index.json';
  const portraitIndex = { version: 1, snapshot: PMD_SNAPSHOT, ...buildPortraitIndex(portraitResults) };
  const manifest = {
    version: 1, snapshot: PMD_SNAPSHOT, repository: 'https://github.com/PMDCollab/SpriteCollab',
    license: 'CC-BY-NC-4.0', tickMs: PMD_TICK_MS,
    coordinateSystem: { anchor: 'frame-center-x, frame-center-y + 4; SpriteBot rel_center', offsets: 'frame top-left relative to anchor; source pixels, never scaled', bbox: 'frame-local alpha>0; null means empty frame' },
    formatReferences: ['https://github.com/PMDCollab/SpriteBot/blob/master/Constants.py', 'https://github.com/PMDCollab/SpriteBot/blob/master/SpriteUtils.py'],
    sizeCalibration: { k: sizing.k, viewport: SIZE_VIEWPORT, exponent: 0.75, skyFactor: 0.83, floors: { ground: 40, sky: 34 } },
    directions: PMD_DIRECTIONS, excluded: [...PMD_EXCLUDED], pokemon: pokemon.map(p => ({ ...p, sizeFactor: sizing.factors[p.entityId] })), portraits, portraitIndex: portraitIndexUrl,
  };
  const creditedArtists = [...artists.keys()].sort().map((id) => names.get(id) ?? artists.get(id)!);
  const creditData = {
    version: 1, snapshot: PMD_SNAPSHOT, repository: manifest.repository, license: manifest.license,
    licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    sources: { names: sources['credit_names.txt'], license: sources['LICENSE.md'] },
    artists: creditedArtists.map((artist) => ({ ...artist,
      resourceIds: resources.filter((resource) => resource.contributions.some((credit) => credit.artistId === artist.id))
        .map((resource) => resource.id).sort(),
    })),
    resources: resources.sort((a, b) => a.id.localeCompare(b.id, 'en')),
  };
  // Generated data is written only after all expected downloads and images validate.
  const updated = await attachPmdPortraits(entities, ROOT);
  if (updated.some((entity) => typeof entity.attrs.pmdPortrait !== 'string')) throw new Error('Faltan retratos publicados');
  updated.forEach((entity) => entitySchema.parse(entity));
  // Compact runtime JSON: frame metadata is useful, indentation is not a download cost.
  await writeChanged(path.join(PUBLIC, ASSETS, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  await writeJson(path.join(PUBLIC, portraitIndexUrl), portraitIndex);
  await writeJson(path.join(ROOT, 'data/pokemon/pmd-credits.json'), creditData);
  await writeJson(ENTITIES, updated);
  await writeJson(SOURCE_INDEX, Object.fromEntries(Object.entries(sources).sort(([a], [b]) => a.localeCompare(b, 'en'))));
  const publicImgBytes = await directoryBytes(path.join(PUBLIC, 'img')), publicThemeBytes = await directoryBytes(path.join(PUBLIC, 'theme'));
  if (publicImgBytes + publicThemeBytes >= 250000000) throw new Error('Assets públicos exceden 250.000.000 bytes');
  console.log(JSON.stringify({ pokemon: pokemon.length, portraits: portraitIndex.available, missingPortraits: Object.fromEntries(Object.entries(portraitIndex.missing).map(([emotion, numbers]) => [emotion, numbers.length])), artists: creditedArtists.length, resources: resources.length, downloaded, cacheHits: hits, auditImports, publicThemeBytes, combinedBytes: publicImgBytes + publicThemeBytes,
    publicImgBytes: await directoryBytes(path.join(PUBLIC, 'img')), pmdThemeBytes: await directoryBytes(path.join(PUBLIC, ASSETS)),
    pmdPortraitBytes: await directoryBytes(path.join(PUBLIC, 'img/pokemon/pmd')), failures: [] }, null, 2));
}

main().catch(async (error: unknown) => {
  stopped = true;
  // Preserve cache hashes even on interrupted downloads; no generated gameplay data is written.
  await writeJson(SOURCE_INDEX, Object.fromEntries(Object.entries(sources).sort(([a], [b]) => a.localeCompare(b, 'en'))));
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

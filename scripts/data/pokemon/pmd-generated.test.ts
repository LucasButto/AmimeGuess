// Verifies the committed outputs of data:pokemon-pmd; never accesses the network.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import entities from '../../../data/pokemon/entities.json';
import { PMD_SNAPSHOT, PMD_DIRECTIONS, PMD_PORTRAIT_EMOTIONS, type PortraitEmotion } from './pmd-core.ts';
import { sha256, sameVisiblePixels } from './pmd-images.ts';
import sharp from 'sharp';
import { PMD_DECISIONS, PMD_WALK_FLYERS, PMD_SERPENTINES, PMD_FORM_HEIGHTS } from './pmd-roster.ts';

const root = path.resolve(import.meta.dirname, '../../..');
interface Sheet {
  anchor: { x: number; y: number };
  url: string; bytes: number; sha256: string; width: number; height: number;
  frameWidth: number; frameHeight: number; sourceRows: number; sourceRow: number;
  bbox: { x: number; y: number; width: number; height: number };
  referenceBbox?: { x: number; y: number; width: number; height: number };
  totalDurationMs: number;
  frames: { sourceIndex?: number; ticks: number; durationMs: number; x: number }[];
}
interface Variant {
  hasHitGround: boolean; recovery: string | null; sleep: { enter: string | null; sleep: string; wake: string } | null;
  metadataSource: { url: string };
  spriteCredit?: { primary: string; secondary: string[] };
  animations: Record<string, { creditId: string; directions: Record<string, Sheet>; shadow?: { creditId: string; directions: Record<string, Sheet> } }>;
}
interface Manifest {
  snapshot: string; tickMs: number; excluded: string[];
  portraitIndex: string;
  pokemon: { sizeFactor: number; formHeightMeters?: number; name: string; number: number; entityId: string; zone: string; movement: string; form: string; locomotion: string; elongated?: boolean; locomotionFrames?: number[]; locomotionFrameMs?: number; burrow?: { emerge: string; idle: string; hide: string }; variants: { normal: Variant; shiny: Variant | null } }[];
  portraits: { entityId: string; number: number; url: string; width: number; height: number; bytes: number; sha256: string; creditId: string }[];
}
const manifest: Manifest = JSON.parse(readFileSync(path.join(root, 'public/theme/pokemon/pmd/manifest.json'), 'utf8'));
const portraitIndex: {
  snapshot: string;
  portraits: Record<string, { entityId: string } & Record<PortraitEmotion, string | null>>;
  available: Record<PortraitEmotion, number>;
  missing: Record<PortraitEmotion, number[]>;
} = JSON.parse(readFileSync(path.join(root, 'public/img/pokemon/pmd/index.json'), 'utf8'));
const credits: { snapshot: string; artists: { id: string; name: string }[]; resources: { id: string; outputs: string[]; contributions: { artistId: string }[] }[] } =
  JSON.parse(readFileSync(path.join(root, 'data/pokemon/pmd-credits.json'), 'utf8'));

describe('PMD archivos generados', () => {
  it('registra sue?o real por variante, todas sus hojas y la recuperaci?n, sin cambiar el resto de zonas', () => {
    let sleepers = 0, ground = 0;
    for (const pokemon of manifest.pokemon) for (const variant of Object.values(pokemon.variants)) {
      if (!variant?.sleep) continue;
      sleepers++;
      if (pokemon.zone === 'ground') ground++;
      expect(variant.sleep.sleep).toBe('Sleep');
      for (const name of [variant.sleep.enter, variant.sleep.sleep, variant.sleep.wake]) if (name) {
        expect(variant.animations[name]).toBeDefined();
        for (const sheet of Object.values(variant.animations[name].directions)) expect(existsSync(path.join(root, 'public', sheet.url))).toBe(true);
      }
    }
    expect(sleepers).toBe(730);
    expect(ground).toBe(592);
    expect(manifest.pokemon.find(pokemon=>pokemon.entityId==='emolga')?.zone).toBe('ground');
    expect(manifest.pokemon.find(pokemon=>pokemon.entityId==='pidgeotto')?.zone).toBe('sky');
    expect(manifest.pokemon.find(pokemon=>pokemon.entityId==='charizard')?.zone).toBe('sky');
  });
  it('usa el snapshot aprobado, 372 entradas con Galar y 1025 retratos, sin los seis excluidos', () => {
    expect(manifest.snapshot).toBe(PMD_SNAPSHOT);
    expect(credits.snapshot).toBe(PMD_SNAPSHOT);
    expect(manifest.pokemon).toHaveLength(372);
    expect(new Set(manifest.pokemon.map(p=>p.entityId)).size).toBe(372);
    expect(manifest.portraits).toHaveLength(1025);
    expect(manifest.excluded).toHaveLength(6);
    expect(manifest.pokemon.some((pokemon) => manifest.excluded.includes(pokemon.name))).toBe(false);
    expect(manifest.pokemon.find((pokemon) => pokemon.name === 'Exeggutor de Alola')).toMatchObject({ number: 103, form: 'alola' });
    expect(manifest.pokemon.find((pokemon) => pokemon.name === 'Hoppip')).toMatchObject({ zone: 'sky', movement: 'drift' });
    expect(manifest.pokemon.every((pokemon) => pokemon.variants.shiny !== null)).toBe(true); // Altcolor sin variocolor propio usa el normal.
  });
  it('aplica todas las decisiones, mantiene la lista blanca de Walk en cielo y acredita las formas exactas', () => {
    for (const [name, decision] of Object.entries(PMD_DECISIONS)) {
      const pokemon = manifest.pokemon.find(p=>p.name===name)!;
      expect(pokemon, name).toBeDefined();
      expect(pokemon.zone).toBe(decision!.zone);
      expect(pokemon.locomotion).toBe(decision!.locomotion);
      if (decision!.movement) expect(pokemon.movement).toBe(decision!.movement);
      if (decision!.sourceForm) {
        expect(pokemon.form).toBe(decision!.form);
        expect(pokemon.variants.normal.metadataSource.url).toContain(`/sprite/${String(pokemon.number).padStart(4,'0')}/${decision!.sourceForm}/AnimData.xml`);
        for (const variant of Object.values(pokemon.variants)) if (variant) {
          expect(variant.spriteCredit?.primary).toBeTruthy();
          const ids=[variant.spriteCredit!.primary,...variant.spriteCredit!.secondary].map(id=>id.replace(/^<@!?(\d+)>$/,'$1'));
          for (const animation of Object.values(variant.animations)) {
            const record=credits.resources.find(resource=>resource.id===animation.creditId)!;
            for(const id of ids)expect(record.contributions.some(c=>c.artistId===id)).toBe(true);
          }
        }
      }
    }
    expect(manifest.pokemon.filter(p=>p.zone==='sky')).toHaveLength(73);
    expect(manifest.pokemon.filter(p=>p.zone==='ground')).toHaveLength(299);
    expect(manifest.pokemon.filter(p=>p.zone==='sky'&&p.locomotion==='Walk').map(p=>p.entityId).sort()).toEqual([...PMD_WALK_FLYERS,'articuno-galar','moltres-galar'].sort());
    for(const p of manifest.pokemon.filter(p=>p.zone==='sky'))for(const variant of Object.values(p.variants))if(variant){
      const animation=variant.animations[p.locomotion];
      expect(animation).toBeDefined();expect(animation.shadow).toBeDefined();
      expect(credits.resources.some(r=>r.id===animation.shadow!.creditId)).toBe(true);
      for(const direction of ['east','west']){
        const sheet=animation.directions[direction],shadow=animation.shadow!.directions[direction];
        expect(shadow.anchor).toEqual(sheet.anchor);
        expect([shadow.frameWidth,shadow.frameHeight]).toEqual([sheet.frameWidth,sheet.frameHeight]);
        expect(shadow.frames).toHaveLength(sheet.frames.length);
        expect(shadow.bbox.width*shadow.bbox.height).toBeGreaterThan(0);
        const image=readFileSync(path.join(root,'public',shadow.url));
        expect(sha256(image)).toBe(shadow.sha256);
      }
    }
    for(const id of ['articuno-galar','zapdos-galar','moltres-galar'])expect(entities.some(e=>e.id===id)).toBe(false);
    for(const p of manifest.pokemon.filter(p=>p.burrow)){
      expect(p.locomotion).toBe('Idle');
      for(const v of Object.values(p.variants))if(v){expect(v.sleep).toBeNull();expect(v.hasHitGround).toBe(false);
        for(const name of Object.values(p.burrow!))for(const direction of ['east','west'])expect(v.animations[name].shadow?.directions[direction].anchor).toEqual(v.animations[name].directions[direction].anchor);
      }
    }
  });
  it('valida todos los recortes, medidas nativas, tiempos, cajas y hashes', () => {
    const creditIds = new Set(credits.resources.map((resource) => resource.id));
    let hasHitGround = 0;
    for (const pokemon of manifest.pokemon) {
      for (const variant of Object.values(pokemon.variants)) {
        if (!variant) continue;
        expect(variant.animations.Walk).toBeDefined();
        expect(variant.hasHitGround).toBe(Boolean(variant.animations.HitGround));
        if (variant.hasHitGround) {
          hasHitGround++;
          expect(variant.recovery).toBe('Idle');
          expect(variant.animations.Idle).toBeDefined();
        }
        for (const animation of Object.values(variant.animations)) {
          expect(creditIds.has(animation.creditId)).toBe(true);
          expect(Object.keys(animation.directions)).toEqual(['east', 'west']);
          for (const [direction, sheet] of Object.entries(animation.directions)) {
            expect(sheet.height).toBe(sheet.frameHeight);
            expect(sheet.width).toBe(sheet.frames.length * sheet.frameWidth);
            expect(sheet.sourceRow).toBe(sheet.sourceRows === 1 ? 0 : PMD_DIRECTIONS[direction as keyof typeof PMD_DIRECTIONS]);
            expect(sheet.bbox.x + sheet.bbox.width).toBeLessThanOrEqual(sheet.frameWidth);
            expect(sheet.bbox.y + sheet.bbox.height).toBeLessThanOrEqual(sheet.frameHeight);
            sheet.frames.forEach((frame, index) => {
              expect(frame.x).toBe(index * sheet.frameWidth);
              expect(frame.durationMs).toBeGreaterThanOrEqual(frame.ticks * 20); expect(frame.durationMs).toBeLessThanOrEqual(Math.ceil(frame.ticks * 20 * 3));
            });
            const image = readFileSync(path.join(root, 'public', sheet.url));
            expect(image.length).toBe(sheet.bytes);
            expect(sha256(image)).toBe(sheet.sha256);
          }
        }
      }
    }
    expect(hasHitGround).toBeGreaterThanOrEqual(125);
  });
  it('cada retrato es PNG 40×40, enlaza su entidad y tiene crédito y hash', () => {
    const creditIds = new Set(credits.resources.map((resource) => resource.id));
    for (const portrait of manifest.portraits) {
      const entity = entities.find((candidate) => candidate.id === portrait.entityId);
      expect(entity?.attrs.numero).toBe(portrait.number);
      expect(entity?.attrs.pmdPortrait).toBe(portrait.url);
      expect(entity?.image).toBe(`pokemon/${entity?.id}`);
      expect(creditIds.has(portrait.creditId)).toBe(true);
      const image = readFileSync(path.join(root, 'public', portrait.url));
      expect(image.subarray(1, 4).toString()).toBe('PNG');
      expect(image.readUInt32BE(16)).toBe(40);
      expect(image.readUInt32BE(20)).toBe(40);
      expect(image.length).toBe(portrait.bytes);
      expect(sha256(image)).toBe(portrait.sha256);
    }
  });
  it('todos los recursos tienen artistas identificados y salidas locales existentes', () => {
    const artists = new Set(credits.artists.map((artist) => artist.id));
    expect(artists.size).toBe(credits.artists.length);
    expect(artists.has('CHUNSOFT')).toBe(true);
    expect(credits.resources.length).toBeGreaterThan(1025);
    for (const resource of credits.resources) {
      expect(resource.contributions.length).toBeGreaterThan(0);
      expect(resource.contributions.every((credit) => artists.has(credit.artistId))).toBe(true);
      expect(resource.outputs.every((url) => existsSync(path.join(root, 'public', url)))).toBe(true);
    }
  });
  it('registra las tres emociones para cada especie, con null y listas exactas cuando faltan', () => {
    expect(manifest.portraitIndex).toBe('/img/pokemon/pmd/index.json');
    expect(portraitIndex.snapshot).toBe(PMD_SNAPSHOT);
    expect(Object.keys(portraitIndex.portraits)).toHaveLength(1025);
    const trackerPath = path.join(root, 'data-src/pokemon/pmd', PMD_SNAPSHOT, 'tracker.json');
    const tracker: Record<string, { portrait_files: Record<string, boolean> }> | null = existsSync(trackerPath) ? JSON.parse(readFileSync(trackerPath, 'utf8')) : null;
    const resources = new Set(credits.resources.map((resource) => resource.id));
    for (const emotion of Object.keys(PMD_PORTRAIT_EMOTIONS) as PortraitEmotion[]) {
      const available: number[] = [], missing: number[] = [];
      for (const entity of entities) {
        const number = entity.attrs.numero, dex = String(number).padStart(4, '0');
        const entry = portraitIndex.portraits[dex];
        expect(entry.entityId).toBe(entity.id);
        const hasPortrait = resources.has(`portrait/${dex}/${PMD_PORTRAIT_EMOTIONS[emotion]}`);
        // Optional source audit: clean checkouts validate committed outputs without downloading the cache.
        if (tracker) expect(hasPortrait).toBe(Object.hasOwn(tracker[dex].portrait_files, PMD_PORTRAIT_EMOTIONS[emotion]));
        if (hasPortrait) {
          expect(entry[emotion]).toBe(`/img/pokemon/pmd/${dex}/${emotion}.png`);
          available.push(number);
        } else {
          expect(entry[emotion]).toBeNull();
          missing.push(number);
        }
      }
      expect(portraitIndex.available[emotion]).toBe(available.length);
      expect(portraitIndex.missing[emotion]).toEqual(missing);
    }
    expect(portraitIndex.available).toEqual({ normal: 1025, happy: 796, sad: 744 });
    expect(portraitIndex.missing.happy).toHaveLength(229);
    expect(portraitIndex.missing.sad).toHaveLength(281);
  });
  it('Happy y Sad son PNG 40×40 sin pérdida y tienen créditos de su emoción', async () => {
    const resources = new Map(credits.resources.map((resource) => [resource.id, resource]));
    for (const [dex, entry] of Object.entries(portraitIndex.portraits)) {
      for (const emotion of ['happy', 'sad'] as const) {
        const url = entry[emotion];
        if (!url) continue;
        const name = PMD_PORTRAIT_EMOTIONS[emotion];
        const resource = resources.get(`portrait/${dex}/${name}`);
        expect(resource?.outputs).toEqual([url]);
        const image = readFileSync(path.join(root, 'public', url));
        expect(image.subarray(1, 4).toString()).toBe('PNG');
        expect(image.readUInt32BE(16)).toBe(40);
        expect(image.readUInt32BE(20)).toBe(40);
        const originalPath = path.join(root, 'data-src/pokemon/pmd', PMD_SNAPSHOT, `portrait/${dex}/${name}.png`);
        if (existsSync(originalPath)) {
          const original = readFileSync(originalPath);
          expect(sameVisiblePixels(await sharp(original).ensureAlpha().raw().toBuffer(), await sharp(image).ensureAlpha().raw().toBuffer())).toBe(true);
        }
        expect(resource?.contributions.length).toBeGreaterThan(0);
      }
    }
  });
});


it('solo ocho vuelos usan f1/f0 a 180 ms; el resto conserva sus hashes de locomocion', () => {
  const ids=['pidgey','pidgeotto','pidgeot','rufflet','fletchling','rookidee','talonflame'];
  expect(manifest.pokemon.filter(p=>p.locomotionFrames).map(p=>p.entityId).sort()).toEqual([...ids,'dragapult','taillow','rayquaza','swellow'].sort());
  for(const p of manifest.pokemon.filter(p=>ids.includes(p.entityId))) {
    expect(p.locomotionFrames).toEqual([1,0]);const frameMs = p.entityId === 'talonflame' ? 300 : 180;expect(p.locomotionFrameMs).toBe(frameMs);
    for(const v of Object.values(p.variants))if(v) {
      const a=v.animations[p.locomotion];
      for(const direction of ['east','west']) {
        const sheet=a.directions[direction],shadow=a.shadow!.directions[direction];
        for(const crop of [sheet,shadow]) {
          expect(crop.frames).toHaveLength(2);
          expect(crop.frames.map(f=>f.sourceIndex)).toEqual([1,0]);
          expect(crop.frames.map(f=>f.durationMs)).toEqual([frameMs,frameMs]);
          expect(crop.totalDurationMs).toBe(frameMs*2);
          expect(crop.width).toBe(2*crop.frameWidth);
          expect(crop.referenceBbox).toBeDefined();
        }
        expect(sheet.anchor).toEqual(shadow.anchor);
      }
    }
  }
  const untouched=manifest.pokemon.filter(p=>p.zone==='sky'&&!ids.includes(p.entityId)&&p.entityId!=='taillow'&&p.entityId!=='rayquaza'&&p.entityId!=='swellow'&&p.entityId!=='togetic'&&p.entityId!=='dragapult'&&p.entityId!=='salamence'&&p.entityId!=='charizard'&&!['starly','staravia','staraptor','braviary','pikipek','fletchinder','aerodactyl','noivern'].includes(p.entityId)).flatMap(p=>Object.entries(p.variants).filter(([,v])=>v).flatMap(([name,v])=>Object.entries(v!.animations[p.locomotion].directions).map(([d,s])=>[p.entityId,name,d,s.sha256])));
  expect(sha256(Buffer.from(JSON.stringify(untouched)))).toBe('6678e24bdbda2a9e3a8017b9d21726529ac5679d1f802e4454494c24860d2208');
  expect(manifest.pokemon.filter(p=>p.elongated).map(p=>p.entityId).sort()).toEqual(Object.keys(PMD_SERPENTINES).sort());
});


it('Salamence vuela con Walk normal y shiny, en este/oeste y con sombra, sin Float', () => {
  const pokemon=manifest.pokemon.find(p=>p.entityId==='salamence')!;
  expect(pokemon.zone).toBe('sky');expect(pokemon.locomotion).toBe('Walk');
  for(const variant of Object.values(pokemon.variants))if(variant) {
    expect(variant.animations.Float).toBeUndefined();
    for(const direction of ['east','west']) {
      const sheet=variant.animations.Walk.directions[direction];
      const shadow=variant.animations.Walk.shadow!.directions[direction];
      expect(sheet.frames).toHaveLength(6);
      expect(sheet.sourceRow).toBe(direction==='east'?2:6);
      expect(shadow.anchor).toEqual(sheet.anchor);
      expect(shadow.frames).toHaveLength(6);
    }
  }
});

it('genera factores de tama?o y alturas regionales para todo el roster', () => {
  expect(manifest.pokemon).toHaveLength(372);
  for(const p of manifest.pokemon) {
    expect(p.sizeFactor,p.entityId).toBeGreaterThanOrEqual(0.5);
    expect(p.sizeFactor,p.entityId).toBeLessThanOrEqual(2);
    expect(p.sizeFactor*1000,p.entityId).toBeCloseTo(Math.round(p.sizeFactor*1000),8);
    expect(p.formHeightMeters,p.entityId).toBe(PMD_FORM_HEIGHTS[p.entityId]);
  }
});

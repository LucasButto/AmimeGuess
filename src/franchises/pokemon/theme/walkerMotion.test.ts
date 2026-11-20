import { sameWalkerGeometry } from './walkerMotion';
import { PARADE_IDS, PARADE_SPEED_REM, DUO_IDS, DUO_SPEED_REM, nextEventMs, nextSwimMs, planParade, planDuo, walkerBodyWidth } from './walkerMotion';
import { walkerBodyExtent } from './walkerMotion';
import { groundTopMargin } from './walkerMotion';
import { LAKE_COUNT, LAKE_IDS, LAKE_LOW_LANE, LAKE_SPEED_REM, WATER_DEPTH_MAX, WATER_DEPTH_MIN, waterBand, waterCeiling } from './walkerMotion';
import { BIRD_IDS, BIRD_SPEED_REM, DOG_IDS, DOG_SPEED_REM, EVENT_KINDS, FAMILY_LINES, FAMILY_SPEED_REM, OUTBREAK_COUNT, RACE_SPEEDS_REM, drawEventKind, planEvent, type EventEntry } from './walkerMotion';
import { FORMATION_KINDS, GROUP_LIFT, formationSlots, formationSpan, formationStepOffsetMs, groupSlots, walkerLeftScene } from './walkerMotion';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  INITIAL_PLAYBACK, HOLD_MS, SHINY_ODDS, createWalkerBags, drawWalkerBag, walkerVerticalArea, advancePlayback, frameAt, appearanceSleep, replenishmentZone, chooseReplenishment, walkerPopulation, planWalker,
  spritePixel, hitsSprite, visibleDelta, walkerCapacity, walkerPose, walkerScale,
  withWalkerHeights, walkerExtents, walkerTargetHeight, chooseGroundLane, mirrorsSheet, rollingGeometry, WALKER_MAX, nextEntranceMs, entranceDirection, walkerFrameBounds, locomotionAnimation, locomotionName, advanceBurrow, burrowBounds, chooseBurrowPosition, walkerSkyFloor, wakeFromPointer,
  type WalkerManifest, type WalkerViewport,
} from './walkerMotion';

const manifest: WalkerManifest = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../..', 'public/theme/pokemon/pmd/manifest.json'), 'utf8'));
const entities = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../..', 'data/pokemon/entities.json'), 'utf8'));
manifest.pokemon = withWalkerHeights(manifest.pokemon, entities);
const bulbasaur = manifest.pokemon.find((pokemon) => pokemon.entityId === 'bulbasaur')!;
const viewport: WalkerViewport = { width: 1920, height: 1080, rem: 16, artPixel: 4, ground: 336 };
const random = () => 0.5;

describe('apariciones PMD', () => {
  it('repone mínimos por zona: entre pasto y río siempre el mismo total; el río, a veces ninguno y hasta dos', () => {
    for (const [width, height, rem, minimum] of [[360,640,16,2],[390,844,16,2],[844,390,16,3],[768,1024,16,3],[1920,1080,16,3],[3840,2160,30,3]]) {
      const population = walkerPopulation(width,height,rem);
      const total = population.ground.max;
      expect(population.ground.min).toBe(minimum);
      expect(population.sky).toEqual({min:1,max:2});
      expect(population.water).toEqual({min:0,max:2});
      expect(walkerCapacity(width,height,rem)).toBeLessThanOrEqual(WALKER_MAX);
      const fill = (waterReady: boolean, start: {zone:'ground'|'sky'|'water';walking:boolean}[] = []) => {
        const actors = [...start];
        while (replenishmentZone(actors,population,waterReady)) actors.push({zone:replenishmentZone(actors,population,waterReady)!,walking:true});
        return actors;
      };
      const count = (actors: {zone:string}[], zone: string) => actors.filter(actor=>actor.zone===zone).length;
      // Sin nadador: todo el total camina por el pasto y hay dos volando.
      const dry = fill(false);
      expect(count(dry,'water')).toBe(0);
      expect(count(dry,'ground')).toBe(total);
      expect(count(dry,'sky')).toBe(2);
      // Cuando toca un nadador, ocupa el lugar de un caminante: el total del pasto y el río no cambia.
      const wet = fill(true);
      expect(count(wet,'water')).toBeGreaterThanOrEqual(1);
      expect(count(wet,'water')).toBeLessThanOrEqual(2);
      expect(count(wet,'ground')+count(wet,'water')).toBe(count(dry,'ground'));
      expect(count(wet,'sky')).toBe(2);
      // Si un nadador debe salir y el pasto está lleno, no entra otro caminante: se espera a que se libere un lugar.
      const grass = Array.from({length:total},()=>({zone:'ground' as const,walking:true}));
      expect(replenishmentZone(grass,population,true)).not.toBe('ground');
      expect(replenishmentZone(grass,population,true)).not.toBe('water');
      const freed = fill(true, [{zone:'sky',walking:true},{zone:'sky',walking:true},...grass.slice(1)]);
      expect(count(freed,'water')).toBe(1);
      expect(count(freed,'ground')).toBe(total-1);
      // Con dos nadando, ya no sale otro y el pasto completa el resto.
      const two = fill(true, [{zone:'water',walking:true},{zone:'water',walking:true}]);
      expect(count(two,'water')).toBe(2);
      expect(count(two,'ground')).toBe(total-2);
      const full = Array.from({length:WALKER_MAX},()=>({zone:'ground' as const,walking:false}));
      expect(replenishmentZone(full,population)).toBeNull();
    }
  });
  it('el próximo nadador normal llega entre veinte segundos y minuto y cuarenta después', () => {
    expect(nextSwimMs(1000, () => 0)).toBe(21_000);
    expect(nextSwimMs(1000, () => 1)).toBe(101_000);
    expect(nextSwimMs(0, () => 0.5)).toBe(60_000);
  });
  it('sue?o por variante, solo en suelo, 1/16 y entre diez y veinte segundos', () => {
    expect(appearanceSleep(bulbasaur.variants.normal,'ground',()=>0)).toEqual({atMs:5000,durationMs:10000});
    expect(appearanceSleep(bulbasaur.variants.normal,'sky',()=>0)).toBeNull();
    expect(appearanceSleep({...bulbasaur.variants.normal,sleep:null},'ground',()=>0)).toBeNull();
    expect(appearanceSleep(bulbasaur.variants.normal,'ground',()=>1/16)).toBeNull();
    const values=[0,1,1];
    expect(appearanceSleep(bulbasaur.variants.normal,'ground',()=>values.shift()!)).toEqual({atMs:11000,durationMs:20000});
    expect(manifest.pokemon.find(p=>p.entityId==='emolga')!.zone).toBe('ground');
    expect(manifest.pokemon.find(p=>p.entityId==='pidgeotto')!.zone).toBe('sky');
  });
  it('acostarse, dormir y despertar congelan recorrido y retoman exactamente el mismo punto', () => {
    const state={phase:'lie' as const,phaseMs:0,travelMs:2000};
    const timing={lieMs:240,sleepMs:20000,wakeMs:840};
    expect(advancePlayback(state,240,0,0,timing)).toMatchObject({phase:'sleep',travelMs:2000});
    expect(advancePlayback(state,20240,0,0,timing)).toMatchObject({phase:'wake',travelMs:2000});
    expect(advancePlayback(state,21080+50,0,0,timing)).toMatchObject({phase:'walk',travelMs:2050});
    const hidden=visibleDelta(100,50000,true);
    expect(advancePlayback(state,hidden.delta,0,0,timing)).toEqual(state);
  });
  it('todos los Pokemon y variantes entran con el cuadro entero fuera, sin fade-in, en ambas direcciones', () => {
    for (const geometry of [viewport,{...viewport,width:360,height:640,ground:224}]) {
      for (const pokemon of manifest.pokemon.filter(p=>!p.burrow)) for (const shiny of [false,true]) for (const direction of ['east','west'] as const) {
        const plan=planWalker(pokemon,geometry,random,{shiny,direction});
        const box=walkerFrameBounds(plan,0,geometry.rem);
        expect(direction==='east'?box.right<=-2*geometry.rem:box.left>=geometry.width+2*geometry.rem).toBe(true);
        expect(walkerPose(plan,0,geometry.rem).opacity).toBe(1);
        // Also cover the first 50 ms polling window, including rotated full-frame corners.
        const early=walkerFrameBounds(plan,50,geometry.rem);
        expect(direction==='east'?early.right<=0:early.left>=geometry.width).toBe(true);
      }
    }
  });
  it('escalona por reloj logico y alterna solo cuando el cuadro anterior despejo su ancho mas dos rem', () => {
    expect(nextEntranceMs(100,()=>0)).toBe(1600);
    expect(nextEntranceMs(100,()=>1)).toBe(2600);
    expect(entranceDirection(1599,1600,'east',[],360,16)).toBeNull();
    expect(entranceDirection(1600,1600,'west',[],360,16)).toBe('west');
    const blocked=[{direction:'east' as const,left:-20,right:80},{direction:'west' as const,left:280,right:380}];
    expect(entranceDirection(5000,1600,'east',blocked,360,16)).toBeNull();
    blocked[0].left=32;blocked[0].right=132;
    expect(entranceDirection(5000,1600,'west',blocked,360,16)).toBe('east');
    blocked[1].left=228;blocked[1].right=328;
    expect(entranceDirection(5000,1600,'west',blocked,360,16)).toBe('west');
    const paused=visibleDelta(100,50000,true);
    expect(entranceDirection(100+paused.delta,1600,'east',[],360,16)).toBeNull();
  });
  it('usa shiny exactamente en el intervalo 1/512 y respeta las variantes inexistentes', () => {
    expect(planWalker(bulbasaur, viewport, () => 1 / SHINY_ODDS - 0.00001).shiny).toBe(true);
    expect(planWalker(bulbasaur, viewport, () => 1 / SHINY_ODDS).shiny).toBe(false);
    expect(planWalker({ ...bulbasaur, variants: { ...bulbasaur.variants, shiny: null } }, viewport, () => 0).shiny).toBe(false);
    expect(planWalker(bulbasaur, viewport, () => 0, { shiny: false }).shiny).toBe(false);
  });
  it('cada dirección entra y sale fuera del viewport y los corredores avanzan más rápido', () => {
    const east = planWalker(bulbasaur, viewport, random, { direction: 'east' });
    const west = planWalker(bulbasaur, viewport, random, { direction: 'west' });
    expect(east.start).toBeLessThan(0); expect(east.end).toBeGreaterThan(viewport.width);
    expect(west.start).toBeGreaterThan(viewport.width); expect(west.end).toBeLessThan(0);
    const run = planWalker({ ...bulbasaur, movement: 'run' }, viewport, random, { direction: 'east' });
    expect(run.speed).toBe(east.speed * 2);
    expect(run.durationMs).toBe(east.durationMs / 2);
  });
  it('todas las variantes caben en su área, incluso caída, recuperación y movimientos propios', () => {
    for (const pokemon of manifest.pokemon) {
      for (const geometry of [viewport, { ...viewport, width: 360, height: 640, ground: 224 }, { ...viewport, width: 844, height: 390, ground: 156.8 }, { ...viewport, width: 3840, height: 2160, rem: 30, artPixel: 8, ground: 630 }]) {
        for (const variant of Object.values(pokemon.variants)) {
          if (!variant) continue;
          const scale = walkerScale(pokemon, variant, geometry);
          expect(Number.isFinite(scale) && scale > 0).toBe(true);
          const area = pokemon.zone === 'ground' ? geometry.ground : geometry.height - geometry.ground;
          expect(walkerExtents(pokemon, variant, scale, geometry.rem).height).toBeLessThanOrEqual(area - 2 * geometry.rem + 0.001);
        }
      }
    }
  });
  it('sitúa el cielo a distintas alturas y los pies dentro de la franja de suelo', () => {
    const ground = planWalker(bulbasaur, viewport, random);
    expect(ground.y).toBeGreaterThan(viewport.height - viewport.ground);
    expect(ground.y).toBeLessThan(viewport.height);
    const aboveFooter = planWalker(bulbasaur, { ...viewport, occluders: [{ x: 0, y: 980, width: 1920, height: 100 }] }, random);
    expect(aboveFooter.canAppear).toBe(true);
    expect(aboveFooter.feetY).toBeLessThan(980 + aboveFooter.visibleHeight * 0.6);
    const sky = { ...bulbasaur, zone: 'sky' as const };
    expect(planWalker(sky, viewport, () => 0.2).y).not.toBe(planWalker(sky, viewport, () => 0.8).y);
    expect(planWalker(sky, viewport, random).y).toBeLessThan(viewport.height - viewport.ground);
  });
});

describe('proporción física y carriles', () => {
  it('usa metros reales de la especie y bbox si falta altura o es una forma regional', () => {
    expect(manifest.pokemon.find((pokemon) => pokemon.entityId === 'groudon')?.heightMeters).toBe(3.5);
    expect(manifest.pokemon.find((pokemon) => pokemon.form === 'alola')?.heightMeters).toBe(10.9);
    expect(withWalkerHeights([bulbasaur], [{ id: 'bulbasaur', attrs: { altura: -1 } }])[0].heightMeters).toBeUndefined();
    const fallback = { ...bulbasaur, heightMeters: undefined };
    expect(walkerTargetHeight(fallback, fallback.variants.normal, viewport)).toBeGreaterThan(0);
  });
  it('Groudon mide al menos tres veces más que Squirtle y Pikachu en móvil, horizontal y escritorio', () => {
    const large = manifest.pokemon.find((pokemon) => pokemon.entityId === 'groudon')!;
    for (const geometry of [viewport, { ...viewport, width: 360, height: 640, ground: 224 }, { ...viewport, width: 844, height: 390, ground: 156.8 }, { ...viewport, width: 3840, height: 2160, rem: 30, artPixel: 8, ground: 630 }]) {
      const length=(p:typeof large)=> {
        const plan=planWalker(p,geometry,random),sheets=Object.values(locomotionAnimation(p,plan.variant).directions);
        const width=Math.max(...sheets.map(s=>s.bbox.width)),height=Math.max(...sheets.map(s=>s.bbox.height));
        return (width>1.25*height?Math.max(width,height):height)*plan.scale;
      };
      for (const id of ['squirtle','pikachu']) expect(length(large)/length(manifest.pokemon.find(p=>p.entityId===id)!)).toBeGreaterThanOrEqual(3);
    }
  });
  it('elige alturas distintas dentro del suelo, con profundidad creciente y sin variar el carril al avanzar', () => {
    const high = planWalker(bulbasaur, viewport, () => 0.1);
    const low = planWalker(bulbasaur, viewport, () => 0.9);
    expect(high.feetY).toBeLessThan(low.feetY);
    expect(high.depth).toBeLessThan(low.depth);
    expect(walkerPose(high, 1000, 16).y).toBe(walkerPose(high, 5000, 16).y);
    for (const plan of [high, low]) {
      const extents = walkerExtents(plan.pokemon, plan.variant, plan.scale, viewport.rem);
      expect(plan.y - extents.top).toBeGreaterThanOrEqual(viewport.height - viewport.ground);
      expect(plan.y + extents.bottom).toBeLessThanOrEqual(viewport.height);
    }
    const occupied = chooseGroundLane(900, 1050, 50, { ...viewport, occupiedLanes: [975] }, random);
    expect(Math.abs(occupied.feetY - 975)).toBeGreaterThanOrEqual(16);
  });
  it('evita la ocultación por tarjetas/pie y no genera una aparición totalmente tapada', () => {
    const blocked = { ...viewport, occluders: [{ x: 0, y: 700, width: 1920, height: 400 }] };
    expect(planWalker(bulbasaur, blocked, random).canAppear).toBe(false);
    expect(chooseGroundLane(960, 960, 60, blocked, random).available).toBe(false);
    expect(chooseGroundLane(960, 960, 60, viewport, random).available).toBe(true);
    const lane = chooseGroundLane(900, 1070, 60, { ...viewport, occluders: [{ x: 0, y: 990, width: 1920, height: 90 }] }, () => 0.99);
    expect(lane.available).toBe(true);
    expect(lane.feetY).toBeLessThanOrEqual(990 + 60 * 0.6);
  });
});

describe('cuadros, caída y pausa', () => {
  it('respeta cada duración XML, el límite exacto de cuadro y la última pose de caída', () => {
    const sheet = bulbasaur.variants.normal.animations.Walk.directions.east;
    expect(frameAt(sheet, 0)).toBe(0);
    expect(frameAt(sheet, sheet.frames[0].durationMs - 1)).toBe(0);
    expect(frameAt(sheet, sheet.frames[0].durationMs)).toBe(1);
    expect(frameAt(sheet, sheet.totalDurationMs)).toBe(0);
    expect(frameAt(sheet, sheet.totalDurationMs + 5000, false)).toBe(sheet.frames.length - 1);
  });
  it('congela avance durante carga, caída, espera e Idle; después sigue en el mismo punto', () => {
    const loading = { ...INITIAL_PLAYBACK, phase: 'loading' as const, travelMs: 2000 };
    expect(advancePlayback(loading, 1000, 400, 300)).toEqual(loading);
    const fall = { ...loading, phase: 'fall' as const };
    expect(advancePlayback(fall, 400, 400, 300)).toMatchObject({ phase: 'hold', travelMs: 2000 });
    expect(advancePlayback(fall, 400 + HOLD_MS, 400, 300)).toMatchObject({ phase: 'recover', travelMs: 2000 });
    expect(advancePlayback(fall, 400 + HOLD_MS + 300 + 50, 400, 300)).toMatchObject({ phase: 'walk', travelMs: 2050 });
  });
  it('no acumula ni aplica tiempo de pestaña oculta', () => {
    expect(visibleDelta(100, 116, false)).toEqual({ last: 116, delta: 16 });
    expect(visibleDelta(116, 50000, true)).toEqual({ last: null, delta: 0 });
    expect(visibleDelta(null, 60000, false)).toEqual({ last: 60000, delta: 0 });
    expect(visibleDelta(60000, 60016, false).delta).toBe(16);
  });
  it('traduce coordenadas de pantalla al píxel real, con escala y rotación', () => {
    const sheet = bulbasaur.variants.normal.animations.Walk.directions.east;
    const pose = { x: 100, y: 200, angle: 90, opacity: 1 };
    expect(spritePixel({ x: 100, y: 204 }, pose, 2, sheet)).toEqual({ x: sheet.anchor.x + 2, y: sheet.anchor.y });
    expect(spritePixel({ x: 104, y: 200 }, { ...pose, angle: 0 }, 2, sheet, true)).toEqual({ x: sheet.anchor.x - 2, y: sheet.anchor.y });
  });
  it('sólo reacciona al alfa del cuadro visible, no a sus márgenes transparentes', () => {
    const sheet = bulbasaur.variants.normal.animations.Walk.directions.east;
    const pixels = new Uint8ClampedArray(sheet.width * sheet.height * 4);
    const pose = { x: 100, y: 200, angle: 0, opacity: 1 };
    pixels[(sheet.anchor.y * sheet.width + sheet.anchor.x) * 4 + 3] = 255;
    expect(hitsSprite({ x: 100, y: 200 }, pose, 2, sheet, 0, pixels)).toBe(true);
    expect(hitsSprite({ x: 102, y: 200 }, pose, 2, sheet, 0, pixels)).toBe(false);
    expect(hitsSprite({ x: -100, y: 200 }, pose, 2, sheet, 0, pixels)).toBe(false);
    expect(hitsSprite({ x: 100, y: 200 }, pose, 2, sheet, 1, pixels)).toBe(false);
  });
  it('revisa TODAS las variantes: una fila se espeja al oeste; ocho filas mantienen 2/6 sin doble espejo', () => {
    let checked = 0;
    for (const pokemon of manifest.pokemon) for (const variant of Object.values(pokemon.variants)) {
      if (!variant) continue;
      for (const animation of Object.values(variant.animations)) for (const direction of ['east', 'west'] as const) {
        const sheet = animation.directions[direction];
        const oneDirection = sheet.sourceRows === 1 || animation.directions.east.sha256 === animation.directions.west.sha256;
        expect(mirrorsSheet(sheet, direction, animation.directions.east)).toBe(oneDirection && direction === 'west');
        expect(sheet.sourceRow).toBe(sheet.sourceRows === 1 ? 0 : direction === 'east' ? 2 : 6);
        checked++;
      }
    }
    expect(checked).toBe(6156);
    const mewtwo = manifest.pokemon.find((pokemon) => pokemon.entityId === 'mewtwo')!.variants.normal;
    expect(mirrorsSheet(mewtwo.animations.HitGround.directions.west, 'west')).toBe(true);
    expect(mirrorsSheet(mewtwo.animations.Idle.directions.west, 'west')).toBe(false);
    const trapinch = manifest.pokemon.find((pokemon) => pokemon.entityId === 'trapinch')!.variants.normal.animations.HitGround.directions;
    expect(trapinch.west.sourceRows).toBe(8);
    expect(mirrorsSheet(trapinch.west, 'west', trapinch.east)).toBe(true);
  });
});

describe('locomocion y madrigueras aprobadas', () => {
  it('Walk es el valor por defecto y el vuelo usa su propia secuencia sin cambiar la referencia de escala', () => {
    const legacy={...bulbasaur}; delete legacy.locomotion;
    expect(locomotionName(legacy)).toBe('Walk');
    expect(locomotionAnimation(legacy,legacy.variants.normal)).toBe(legacy.variants.normal.animations.Walk);
    const bird=manifest.pokemon.find(p=>p.entityId==='pidgey')!;
    const locomotion=locomotionAnimation(bird,bird.variants.normal);
    expect(locomotionName(bird)).toBe('FlapAround');
    expect(locomotion.directions.east.frames).toHaveLength(2);
    expect(walkerScale(bird,bird.variants.normal,viewport)).toBe(walkerScale({...bird,locomotion:'Walk'},bird.variants.normal,viewport));
    const sheet=locomotion.directions.east;
    expect(frameAt(sheet,sheet.totalDurationMs)).toBe(0);
    expect(frameAt(sheet,sheet.totalDurationMs-1)).toBe(sheet.frames.length-1);
    for(const [id,height] of [['articuno-galar',1.7],['zapdos-galar',1.6],['moltres-galar',2]] as const)expect(manifest.pokemon.find(p=>p.entityId===id)?.heightMeters).toBe(height);
    expect(manifest.pokemon.find(p=>p.entityId==='charizard')?.heightMeters).toBe(1.7);
  });
  it('DigIn sale, Idle espera entre 3 y 6 segundos y DigOut se mete, siempre sin fundido ni avance', () => {
    for(const id of ['diglett','dugtrio'])for(const shiny of [false,true])for(const direction of ['east','west'] as const){
      const p=manifest.pokemon.find(p=>p.entityId===id)!,plan=planWalker(p,viewport,random,{shiny,direction});
      const recipe=p.burrow!,animations=plan.variant.animations;
      const emerge=animations[recipe.emerge].directions[direction],hide=animations[recipe.hide].directions[direction];
      const timing={emerge:emerge.totalDurationMs,idle:plan.burrowIdleMs!,hide:hide.totalDurationMs};
      expect(timing.idle).toBeGreaterThanOrEqual(3000);expect(timing.idle).toBeLessThanOrEqual(6000);
      const state={...INITIAL_PLAYBACK,phase:'emerge' as const};
      expect(advanceBurrow(state,timing.emerge,timing)).toMatchObject({phase:'burrow-idle',travelMs:0,phaseMs:0});
      expect(advanceBurrow(state,timing.emerge+timing.idle,timing)).toMatchObject({phase:'hide',travelMs:0});
      expect(advanceBurrow(state,timing.emerge+timing.idle+timing.hide,timing)).toMatchObject({phase:'done',travelMs:0});
      expect(advanceBurrow(state,visibleDelta(10,100000,true).delta,timing)).toEqual(state);
      const box=burrowBounds(plan, viewport.rem);
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y).toBeGreaterThanOrEqual(viewport.height-viewport.ground);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
      for(const elapsed of [0,timing.emerge,timing.emerge+timing.idle,plan.durationMs])expect(walkerPose(plan,elapsed,16)).toEqual({x:plan.start,y:plan.y,angle:0,opacity:1});
      expect(plan.variant.hasHitGround).toBe(false);expect(plan.variant.sleep).toBeNull();
      const area=(box: {width:number;height:number}|null)=>box?box.width*box.height:0;
      expect(area(emerge.frames[0].bbox)).toBeLessThan(area(emerge.frames.at(-1)!.bbox));
      expect(area(hide.frames.at(-1)!.bbox)).toBeLessThan(area(hide.frames[0].bbox));
    }
  });
});

describe('movimientos propios', () => {
  it('todos los que ruedan usan el cuerpo opaco, una vuelta por circunferencia y apoyo fijo por cuadro', () => {
    const rollers = manifest.pokemon.filter(pokemon => pokemon.movement === 'roll');
    expect(rollers.map(pokemon => pokemon.entityId).sort()).toEqual(['electrode', 'voltorb']);
    for (const pokemon of rollers) for (const shiny of [false, true]) for (const direction of ['east', 'west'] as const) {
      const plan = planWalker(pokemon, viewport, random, {direction, shiny});
      const animation = plan.variant.animations.Walk;
      const sheet = animation.directions[direction];
      const mirrored = mirrorsSheet(sheet, direction, animation.directions.east);
      const geometry = rollingGeometry(sheet,plan.scale,mirrored);
      const centerY = plan.feetY - geometry.radius;
      const revolutionMs = 2 * Math.PI * geometry.radius / plan.speed * 1000;
      const begin = walkerPose(plan,0,viewport.rem);
      const end = walkerPose(plan,revolutionMs,viewport.rem);
      expect(end.angle-begin.angle).toBeCloseTo(direction==='east'?360:-360,8);
      expect(Math.abs(end.x-begin.x)).toBeCloseTo(2*Math.PI*geometry.radius,8);
      for (let frameIndex=0;frameIndex<sheet.frames.length;frameIndex++) {
        const shape=rollingGeometry(sheet,plan.scale,mirrored,frameIndex);
        const bounds=sheet.frames[frameIndex].bbox!;
        const pose={...walkerPose(plan,frameIndex*113,viewport.rem),...shape};
        const localX=(bounds.x+bounds.width/2-sheet.anchor.x+shape.frameOffsetX)*plan.scale*(mirrored?-1:1);
        const localY=(bounds.y+bounds.height/2-sheet.anchor.y+shape.frameOffsetY)*plan.scale;
        expect(localX).toBeCloseTo(shape.pivotX,8);
        expect(localY).toBeCloseTo(shape.pivotY,8);
        expect(pose.y+localY).toBeCloseTo(centerY,8);
        expect(pose.y+localY+shape.radius).toBeCloseTo(plan.feetY,8);
        // Inverse hit-test follows the same pivot, mirroring and frame compensation.
        const pixelX=bounds.x+0.5,pixelY=bounds.y+0.5;
        const x=(pixelX-sheet.anchor.x+shape.frameOffsetX)*plan.scale*(mirrored?-1:1)-shape.pivotX;
        const y=(pixelY-sheet.anchor.y+shape.frameOffsetY)*plan.scale-shape.pivotY;
        const angle=pose.angle*Math.PI/180;
        const point={x:pose.x+shape.pivotX+x*Math.cos(angle)-y*Math.sin(angle),y:pose.y+shape.pivotY+x*Math.sin(angle)+y*Math.cos(angle)};
        expect(spritePixel(point,pose,plan.scale,sheet,mirrored)).toEqual({x:Math.floor(pixelX),y:Math.floor(pixelY)});
      }
    }
  });

  it('conserva movimientos propios y las madrigueras son la excepcion estacionaria', () => {
    const plans = ['walk', 'roll', 'stagger', 'zigzag', 'drift', 'hop', 'hover', 'burrow'].map((movement) =>
      planWalker({ ...bulbasaur, movement: movement as typeof bulbasaur.movement }, viewport, random));
    const poses = plans.map((plan) => walkerPose(plan, 720, 16));
    expect(poses[1].angle).not.toBe(0);
    expect(poses[2].angle).not.toBe(0);
    for (const index of [3, 4, 5, 6]) expect(poses[index].y).not.toBe(poses[0].y);
    expect(walkerPose(plans[7], 1000, 16).x).not.toBe(walkerPose(plans[7], 6000, 16).x);
    expect(walkerPose(plans[7], 0, 16).opacity).toBe(1);
    for (const id of ['diglett','dugtrio']) {
      const plan=planWalker(manifest.pokemon.find(p=>p.entityId===id)!,viewport,random,{direction:'east'});
      expect(plan.start).toBeGreaterThanOrEqual(viewport.width*0.15);
      expect(plan.start).toBeLessThanOrEqual(viewport.width*0.85);
      expect(walkerPose(plan,1000,16).x).toBe(walkerPose(plan,5000,16).x);
      expect(walkerPose(plan,0,16).opacity).toBe(1);
      expect(walkerPose(plan,1000,16).y).toBe(walkerPose(plan,5000,16).y);
    }
  });
});


describe('posicion descubierta de Diglett y Dugtrio', () => {
  it('busca ambos margenes completos incluso si el selector vertical descarta el carril', () => {
    for (const [width,height,rem,ground,margin] of [[1920,1080,16,336,350],[1920,1080,16,336,360],[3840,2160,30,630,780]]) {
      const scene: WalkerViewport={width,height,rem,artPixel:4,ground,occluders:[{x:margin,y:height-ground,width:width-margin*2,height:ground}]};
      for(const id of ['diglett','dugtrio']) for(const shiny of [false,true]) for(const direction of ['east','west'] as const) {
        const p=manifest.pokemon.find(p=>p.entityId===id)!;
        const plan=planWalker(p,scene,random,{shiny,direction});
        expect(plan.canAppear).toBe(false);
        const sides=new Set<string>();
        for(const draw of [0,0.999999]) {
          const placed=chooseBurrowPosition(plan,scene,()=>draw);
          expect(placed).not.toBeNull();
          const box=burrowBounds(placed!, rem);
          expect(box.x).toBeGreaterThanOrEqual(-0.000001);
          expect(box.x+box.width).toBeLessThanOrEqual(width+0.000001);
          expect(box.y).toBeGreaterThanOrEqual(height-ground-0.000001);
          expect(box.y+box.height).toBeLessThanOrEqual(height+0.000001);
          expect(box.x+box.width<=margin+0.000001||box.x>=width-margin-0.000001).toBe(true);
          sides.add(box.x<width/2?'left':'right');
          expect(placed).toMatchObject({canAppear:true,shiny,direction,burrowIdleMs:plan.burrowIdleMs,durationMs:plan.durationMs});
          expect(placed!.start).toBe(placed!.end);
          expect(placed!.depth).toBe(100+Math.round(placed!.lane*1000));
        }
        expect([...sides].sort()).toEqual(['left','right']);
      }
    }
  });
  it('prueba carril y x juntos, incluso en un borde superior estrecho de la franja', () => {
    const p=manifest.pokemon.find(p=>p.entityId==='diglett')!;
    const plan=planWalker(p,viewport,random),bounds=burrowBounds(plan, viewport.rem);
    // El borde de arriba ya no es el del pasto: se descarta la franja pegada al agua (groundTopMargin).
    const top=viewport.height-viewport.ground+groundTopMargin(viewport);
    const scene={...viewport,occluders:[{x:0,y:top+bounds.height+1,width:viewport.width,height:viewport.ground}]};
    const placed=chooseBurrowPosition({...plan,canAppear:false},scene,()=>0.75,box=>box.y+box.height<=top+bounds.height+1);
    expect(placed).not.toBeNull();
    expect(burrowBounds(placed!, viewport.rem).y).toBeCloseTo(top);
  });
  it('valida tambien los huecos contra el hit-test y devuelve null cuando todo esta cubierto', () => {
    const p=manifest.pokemon.find(p=>p.entityId==='dugtrio')!;
    const plan=planWalker(p,viewport,random);
    const placed=chooseBurrowPosition(plan,viewport,()=>0.5,box=>box.x+box.width<=350);
    expect(placed).not.toBeNull();
    expect(burrowBounds(placed!, viewport.rem).x+burrowBounds(placed!, viewport.rem).width).toBeLessThanOrEqual(350.000001);
    expect(chooseBurrowPosition(plan,viewport,random,()=>false)).toBeNull();
    expect(chooseBurrowPosition(plan,{...viewport,occluders:[{x:0,y:0,width:viewport.width,height:viewport.height}]},random)).toBeNull();
    expect(chooseBurrowPosition(plan,{...viewport,width:1},random)).toBeNull();
  });
  it('prefiere carriles separados y conserva los restantes si no queda uno separado', () => {
    const p=manifest.pokemon.find(p=>p.entityId==='diglett')!;
    const plan=planWalker(p,viewport,random);
    const first=chooseBurrowPosition(plan,viewport,()=>0)!;
    const separated=chooseBurrowPosition(plan,{...viewport,occupiedLanes:[first.feetY]},()=>0)!;
    expect(Math.abs(first.feetY-separated.feetY)).toBeGreaterThanOrEqual(viewport.rem);
    const occupied=Array.from({length:Math.ceil(viewport.ground/8)+1},(_,i)=>viewport.height-viewport.ground+i*8);
    expect(chooseBurrowPosition(plan,{...viewport,occupiedLanes:occupied},random)).not.toBeNull();
  });
});


it('el recuadro de cuerpo incluye Idle, DigOut y sombras con 1 rem, sin contar particulas de DigIn', () => {
  for(const id of ['diglett','dugtrio']) for(const shiny of [false,true]) for(const direction of ['east','west'] as const) {
    const p=manifest.pokemon.find(p=>p.entityId===id)!;
    const plan=planWalker(p,viewport,random,{shiny,direction});
    const bounds=burrowBounds(plan,viewport.rem);
    const variant=structuredClone(plan.variant);
    // Detached dirt may extend arbitrarily without changing the body's clearance.
    variant.animations.DigIn.directions[direction].bbox={x:-500,y:-500,width:1000,height:1000};
    expect(burrowBounds({...plan,variant},viewport.rem)).toEqual(bounds);
    const unpadded=burrowBounds(plan,0);
    expect(bounds.x).toBeCloseTo(unpadded.x-viewport.rem);
    expect(bounds.y).toBeCloseTo(unpadded.y-viewport.rem);
    expect(bounds.width).toBeCloseTo(unpadded.width+2*viewport.rem);
    expect(bounds.height).toBeCloseTo(unpadded.height+2*viewport.rem);
    const shifted=structuredClone(plan.variant);
    shifted.animations.Idle.shadow!.directions[direction].bbox={x:-500,y:-500,width:1000,height:1000};
    expect(burrowBounds({...plan,variant:shifted},viewport.rem).width).toBeGreaterThan(bounds.width);
    const placed=chooseBurrowPosition(plan,{...viewport,occluders:[{x:350,y:0,width:viewport.width-700,height:viewport.height}]},random);
    expect(placed).not.toBeNull();
    expect(placed!.scale).toBe(plan.scale);
  }
});


describe('bolsas persistentes por zona', () => {
  const request = {
    bags: createWalkerBags(), pokemon: manifest.pokemon,
    actors: [{zone:'sky' as const,walking:true}],
    population: walkerPopulation(viewport.width,viewport.height,viewport.rem),
    now:10000,nextAt:1000,pending:false,lastDirection:'west' as const,
    previous:[] as {direction:'east'|'west';left:number;right:number}[],
    width:viewport.width,rem:viewport.rem,
  };
  it('no consume sorteos ni bolsa con la entrada bloqueada', () => {
    let draws=0;
    const random=()=>{draws++;return 0.5;};
    const blocked=[{direction:'east' as const,left:-100,right:100},{direction:'west' as const,left:1820,right:2020}];
    for(let i=0;i<6000;i++) expect(chooseReplenishment({...request,now:10000+i*16,previous:blocked,lastDirection:null},random)).toBeNull();
    expect(chooseReplenishment({...request,pending:true},random)).toBeNull();
    expect(chooseReplenishment({...request,now:999,nextAt:1000},random)).toBeNull();
    expect(draws).toBe(0);
    expect(request.bags.ground.remaining).toHaveLength(0);
  });
  it('agota cada pool sin repeticiones y sin favorecer burrow, luego vuelve a barajar', () => {
    const pool=manifest.pokemon.filter(p=>p.zone==='ground');
    let bags=createWalkerBags();
    for(let cycle=1;cycle<=3;cycle++) {
      const selected=[];
      for(let i=0;i<pool.length;i++) {
        const choice=chooseReplenishment({...request,bags},()=>0.37)!;
        bags=choice.bags; selected.push(choice.pokemon);
      }
      expect(new Set(selected.map(p=>p.entityId)).size).toBe(pool.length);
      expect(selected.filter(p=>p.burrow)).toHaveLength(2);
      expect(bags.ground.cycle).toBe(cycle);
      expect(bags.ground.remaining).toHaveLength(0);
      expect(bags.sky).toEqual(createWalkerBags().sky);
    }
  });
  it('mantiene bolsas separadas y posterga activos sin rellenar antes de tiempo', () => {
    const pool=['a','b','c'];
    const start=createWalkerBags();
    const draw=drawWalkerBag(start.ground,pool,new Set(['a']),()=>0.999)!;
    expect(draw.id).toBe('b');
    expect(draw.bag.remaining).toEqual(['a','c']);
    const next=drawWalkerBag(draw.bag,pool,new Set(['a']),()=>{throw new Error('No reshuffle');})!;
    expect(next.id).toBe('c');
    expect(drawWalkerBag(next.bag,pool,new Set(['a']),()=>{throw new Error('No early refill');})).toBeNull();
    expect(drawWalkerBag(next.bag,pool,new Set(),()=>0)?.id).toBe('a');
    expect(drawWalkerBag(start.sky,['sky'],new Set(),()=>0)?.id).toBe('sky');
    expect(start.ground.remaining).toHaveLength(0);
  });
  it('aplica el mismo escalonado a burrow', () => {
    const pokemon=request.pokemon.filter(p=>p.burrow);
    const choice=chooseReplenishment({...request,pokemon,previous:[{direction:'east',left:-100,right:100}]},()=>0.5)!;
    expect(choice.direction).toBe('west');
    const nextAt=nextEntranceMs(request.now,()=>0.5);
    expect(chooseReplenishment({...request,pokemon,now:nextAt-1,nextAt},()=>{throw new Error('Blocked draw');})).toBeNull();
  });
});

it('corrige largos, conserva erguidos y limita el ancho respecto de la referencia fisica', () => {
  for(const scene of [viewport,{...viewport,width:360,height:640,ground:224}]) {
    for(const p of manifest.pokemon) for(const v of Object.values(p.variants)) if(v) {
      const dimensions=Object.values(locomotionAnimation(p,v).directions);
      const width=Math.max(...dimensions.map(s=>s.bbox.width));
      const scale=walkerScale(p,v,scene);
      // Two reference lengths allow open wings and <=10% integer-zoom rounding.
      expect(width*scale/(walkerTargetHeight(p,v,scene)*(p.sizeFactor??1)),p.entityId).toBeLessThanOrEqual(2);
    }
    const reference=(id:string)=> {
      const p=manifest.pokemon.find(p=>p.entityId===id)!;
      return Math.max(...Object.values(locomotionAnimation(p,p.variants.normal).directions).map(s=>Math.max(s.bbox.width,s.bbox.height)))*walkerScale(p,p.variants.normal,scene);
    };
    const sizes=['pikachu','charizard','snorlax','onix'].map(reference);
    for(let i=1;i<sizes.length;i++)expect(sizes[i]).toBeGreaterThan(sizes[i-1]);
  }
  // Pre-change scales: these upright reference poses must remain identical.
  for(const [id,desktop,mobile] of [['pikachu',3,2],['charizard',4,2.496913133465064],['snorlax',6,4]] as const) {
    const p=manifest.pokemon.find(p=>p.entityId===id)!;
    expect(walkerScale({...p,sizeFactor:1},p.variants.normal,viewport)).toBeCloseTo(desktop,8);
    expect(walkerScale({...p,sizeFactor:1},p.variants.normal,{...viewport,width:360,height:640,ground:224})).toBeCloseTo(mobile,8);
  }
});


it('solo la marca explicita usa altura efectiva 0.4 y no recibe una segunda correccion de ancho', () => {
  const ids=['serperior','dratini','ekans','arbok','seviper','onix','dragonair','rayquaza','snom'];
  expect(manifest.pokemon.filter(p=>p.elongated).map(p=>p.entityId).sort()).toEqual(ids.sort());
  for(const scene of [viewport,{...viewport,width:360,height:640,ground:224}]) for(const p of manifest.pokemon.filter(p=>p.elongated)) {
    const v=p.variants.normal;
    expect(walkerTargetHeight(p,v,scene)).toBe(walkerTargetHeight({...p,elongated:false,heightMeters:p.heightMeters!*0.4},v,scene));
    // An upright aspect override makes the ordinary branch use the same native-height reference.
    const upright=structuredClone(v);
    for(const sheet of Object.values(locomotionAnimation(p,upright).directions))sheet.referenceBbox={...sheet.bbox,width:sheet.bbox.height};
    const ordinary={...p,elongated:false,heightMeters:p.heightMeters!*0.4};
    expect(walkerScale(p,v,scene)).toBe(walkerScale(ordinary,upright,scene));
  }
  for(const id of ['hatterene','gastly','haunter','lugia','dialga','palkia','spinda','hippopotas','hippowdon'])expect(manifest.pokemon.find(p=>p.entityId===id)?.elongated).toBeUndefined();
  const idSize=(id:string)=>{const p=manifest.pokemon.find(p=>p.entityId===id)!;return planWalker(p,viewport,random).visibleHeight;};
  // Formula result, without arbitrary overrides to satisfy the contradictory requested ordering.
  const ordered=['pikachu','seviper','charizard','arbok','snorlax','onix'].map(idSize);
  for(let i=1;i<ordered.length;i++)expect(ordered[i]).toBeGreaterThan(ordered[i-1]);
  // Rayquaza vuela con el cuerpo estirado: su tamaño corporal sigue siendo mayor que el de Seviper.
  expect(idSize('rayquaza')).toBeGreaterThan(idSize('seviper'));
});

it('conserva el zoom corporal de Walk al recortar los ocho aleteos', () => {
  const scales=[['pidgey',2.4347826086956523,1.565217391304348],['pidgeotto',5,3],['pidgeot',6,3.431169712995124],['rufflet',2.2864409986319942,1.3630808671597539],['fletchling',3,1.8],['rookidee',2.4347826086956523,1.565217391304348],['talonflame',3.580533008832311,2]] as const;
  for(const [id,desktop,mobile]of scales) {
    const p=manifest.pokemon.find(p=>p.entityId===id)!;
    expect(walkerScale({...p,sizeFactor:1},p.variants.normal,viewport),id).toBeCloseTo(desktop,3);
    expect(walkerScale({...p,sizeFactor:1},p.variants.normal,{...viewport,width:360,height:640,ground:224}),id).toBeCloseTo(mobile,3);
    const sheet=locomotionAnimation(p,p.variants.normal).directions.east;
    expect((id==='talonflame'?[0,299,300,599,600]:[0,179,180,359,360]).map(ms=>frameAt(sheet,ms))).toEqual([0,0,1,1,0]);
  }
});


it('Salamence conserva su escala corporal anterior al reemplazar Float por Walk', () => {
  const p=manifest.pokemon.find(p=>p.entityId==='salamence')!;
  for(const [width,height,rem,artPixel,ground,expected]of [[1920,1080,16,4,336,3],[360,640,16,4,224,2],[844,390,16,4,156.8,2],[3840,2160,30,8,630,6]])
    for(const variant of Object.values(p.variants))if(variant)expect(walkerScale({...p,sizeFactor:1},variant,{width,height,rem,artPixel,ground})).toBe(expected);
});


it('nunca elige un Pokémon que ya está en escena', () => {
  const pokemon = manifest.pokemon.filter(p => p.zone === 'ground').slice(0, 3);
  const request = { bags: createWalkerBags(), pokemon, actors: [{ zone: 'sky' as const, walking: true }], population: walkerPopulation(1920, 1080, 16), now: 10, nextAt: 0, pending: false, lastDirection: null, previous: [], width: 1920, rem: 16 };
  for (let i = 0; i < 50; i++) {
    const choice = chooseReplenishment({ ...request, activeIds: [pokemon[0].entityId, pokemon[1].entityId] }, () => i / 50);
    expect(choice?.pokemon.entityId).toBe(pokemon[2].entityId);
  }
  expect(chooseReplenishment({ ...request, activeIds: pokemon.map(p => p.entityId) }, () => 0.5)).toBeNull();
});


it('ajusta el presupuesto y el recorrido de todos los voladores al cielo sobre las copas', () => {
  for(const scene of [{...viewport,width:360,height:640,ground:224,skyFloor:318},{...viewport,width:844,height:390,ground:156.8,skyFloor:169},{...viewport,skyFloor:595}]) {
    for(const p of manifest.pokemon.filter(p=>p.zone==='sky')) for(const shiny of [false,true]) for(const direction of ['east','west'] as const) for(const draw of [0,1]) {
      const plan=planWalker(p,scene,()=>draw,{shiny,direction});
      expect(plan.canAppear,p.entityId).toBe(true);
      const extents=walkerExtents(p,plan.variant,plan.scale,scene.rem);
      expect(plan.y-extents.top,p.entityId).toBeGreaterThanOrEqual(-0.000001);
      expect(plan.y+extents.bottom,p.entityId).toBeLessThanOrEqual(walkerSkyFloor(scene)+0.000001);
      expect(extents.height,p.entityId).toBeLessThanOrEqual(walkerSkyFloor(scene)-2*scene.rem+0.000001);
    }
    for(const id of ['rayquaza','lugia']) {
      const p=manifest.pokemon.find(p=>p.entityId===id)!;
      expect(walkerTargetHeight(p,p.variants.normal,scene)).toBeLessThanOrEqual(walkerTargetHeight(p,p.variants.normal,{...scene,skyFloor:undefined}));
    }
  }
  expect(walkerSkyFloor({...viewport,skyFloor:0})).toBe(0);
  expect(planWalker(manifest.pokemon.find(p=>p.entityId==='rayquaza')!,{...viewport,skyFloor:0},random).canAppear).toBe(false);
  expect(walkerSkyFloor({...viewport,skyFloor:2000})).toBe(viewport.height-viewport.ground);
});

it('el clic y el toque despiertan solo sobre pixeles expuestos, sin adelantar el viaje', () => {
  const sheet=bulbasaur.variants.normal.animations.Sleep.directions.east;
  const x=sheet.bbox.x+1,y=sheet.bbox.y+1;
  const pixels=new Uint8ClampedArray(sheet.width*sheet.height*4);
  pixels[((sheet.frames[0].y+y)*sheet.width+sheet.frames[0].x+x)*4+3]=255;
  const pose={x:200,y:300,angle:0,opacity:1};
  const pointer={hidden:false,dialogOpen:false,uncovered:true,pointerType:'mouse',button:0,pose,scale:2,sheet,frame:0,pixels,point:{x:pose.x+(x-sheet.anchor.x)*2,y:pose.y+(y-sheet.anchor.y)*2}};
  for(const phase of ['lie','sleep'] as const) {
    const state={phase,phaseMs:500,travelMs:3000};
    for(const pointerType of ['mouse','touch']) {
      const woken=wakeFromPointer(state,{...pointer,pointerType});
      expect(woken).toEqual({phase:'wake',phaseMs:0,travelMs:3000});
      const walked=advancePlayback(woken,320,0,0,{lieMs:100,sleepMs:20000,wakeMs:320});
      expect(walked).toEqual({phase:'walk',phaseMs:0,travelMs:3000});
      expect(advancePlayback(walked,16,0,0).travelMs).toBe(3016);
    }
    for(const override of [{hidden:true},{dialogOpen:true},{uncovered:false},{button:2},{point:{x:-10000,y:-10000}},{pixels:new Uint8ClampedArray(pixels.length)}])expect(wakeFromPointer(state,{...pointer,...override})).toBe(state);
  }
  expect(wakeFromPointer(INITIAL_PLAYBACK,pointer)).toBe(INITIAL_PLAYBACK);
});

it('factores completos y presupuesto hasta las copas sin mover los pies fuera del pasto', () => {
  for(const scene of [{...viewport,skyFloor:604},{...viewport,width:360,height:640,ground:224,skyFloor:318}]) {
    for(const p of manifest.pokemon) {
      expect(p.sizeFactor,p.entityId).toBeGreaterThanOrEqual(0.5);
      expect(p.sizeFactor,p.entityId).toBeLessThanOrEqual(2);
      for(const shiny of [false,true]) {
        const plan=planWalker(p,scene,random,{shiny:shiny&&Boolean(p.variants.shiny)});
        expect(walkerExtents(p,plan.variant,plan.scale,scene.rem).height,p.entityId).toBeLessThanOrEqual(walkerVerticalArea(p,scene)-2*scene.rem+0.01);
        if(p.zone==='ground'&&plan.canAppear)expect(plan.feetY).toBeGreaterThanOrEqual(scene.height-scene.ground);
      }
    }
  }
  const scene={...viewport,skyFloor:604};
  const height=(id:string)=>{const p=manifest.pokemon.find(p=>p.entityId===id)!;return p.variants.normal.animations.Walk.directions.east.bbox.height*walkerScale(p,p.variants.normal,scene);};
  expect(height('pikachu')).toBeLessThan(height('charizard'));
  expect(height('charizard')).toBeLessThan(height('snorlax'));
  for(const id of ['onix','dialga'])expect(height(id)).toBeGreaterThan(height('snorlax'));
  expect(SHINY_ODDS).toBe(512);
});


it('conserva actores al cambiar oclusiones y solo reconstruye ante otra geometría', () => {
  const viewport = { width: 1280, height: 720, rem: 16, artPixel: 4, ground: 231.828125 };
  expect(sameWalkerGeometry(viewport, { ...viewport, occluders: [{ x: 0, y: 0, width: 1280, height: 720 }], occupiedLanes: [500] })).toBe(true);
  for (const change of [{ width: 390 }, { height: 844 }, { rem: 20 }, { artPixel: 5 }, { ground: 250 }]) {
    expect(sameWalkerGeometry(viewport, { ...viewport, ...change })).toBe(false);
  }
});

describe('grupos: Falinks en formación', () => {
  const falinks = manifest.pokemon.find((pokemon) => pokemon.entityId === 'falinks')!;
  const scenes = [viewport, { ...viewport, width: 360, height: 640, ground: 224 }, { ...viewport, width: 844, height: 390, ground: 160 }];
  const seeds = [0.1, 0.9, 0.4, 0.7, 0.2, 0.55];
  const unit = { unitW: 40, unitH: 40, seeds };

  it('Falinks son seis Troopers sin tropiezo ni sueño, con variocolor propio', () => {
    expect(falinks.group).toEqual({ count: 6 });
    expect(falinks.form).toBe('trooper');
    expect(falinks.variants.normal.hasHitGround).toBe(false);
    expect(falinks.variants.normal.sleep).toBeNull();
    expect(falinks.variants.shiny).not.toBeNull();
  });

  it('hay cuatro formas, ninguna sube y baja caminando, y la elegida queda en el plan', () => {
    expect(FORMATION_KINDS).toEqual(['line', 'stagger', 'pins', 'ring']);
    for (const kind of FORMATION_KINDS) {
      const plan = planWalker(falinks, viewport, random, { direction: 'east', formation: kind });
      expect(plan.formation?.kind).toBe(kind);
      expect(plan.formation?.seeds).toHaveLength(6);
      expect(plan.formation!.span).toBeCloseTo(formationSpan(kind, 6, plan.formation!.unitW), 8);
    }
    // Sin forma pedida, el azar reparte las cuatro.
    const picked = new Set([0, 0.26, 0.51, 0.76].map((value) => planWalker(falinks, viewport, () => value, { direction: 'east' }).formation!.kind));
    expect(picked.size).toBe(4);
  });

  it('la fila recta va en línea y al compás; las demás se separan del carril sin pasar el tope', () => {
    const line = formationSlots({ kind: 'line', ...unit }, 6, 3);
    expect(line.map((slot) => slot.lift)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(line[0].back).toBe(0);
    for (let index = 1; index < 6; index++) expect(line[index].back).toBeGreaterThan(line[index - 1].back);
    expect(formationStepOffsetMs('line', 0.7, 600)).toBe(0);
    expect(formationStepOffsetMs('pins', 0.7, 600)).toBe(0);
    expect(formationStepOffsetMs('ring', 0.5, 600)).toBe(300);
    for (const kind of FORMATION_KINDS) for (const seconds of [0, 0.37, 1.9, 7.3, 25]) {
      const slots = formationSlots({ kind, ...unit }, 6, seconds);
      expect(slots).toHaveLength(6);
      for (const slot of slots) {
        expect(Math.abs(slot.lift), `${kind} ${seconds}`).toBeLessThanOrEqual(GROUP_LIFT * unit.unitH + 1e-9);
        expect(slot.back, `${kind} ${seconds}`).toBeGreaterThanOrEqual(-1e-9);
        expect(slot.back, `${kind} ${seconds}`).toBeLessThanOrEqual(formationSpan(kind, 6, unit.unitW) + 1e-9);
      }
    }
    // Las formas no rectas de verdad suben y bajan.
    const lifts = formationSlots({ kind: 'stagger', ...unit }, 6, 2).map((slot) => slot.lift);
    expect(Math.min(...lifts)).toBeLessThan(0);
    expect(Math.max(...lifts)).toBeGreaterThan(0);
    // El círculo no gira y los bolos no se mueven: el mismo puesto en cualquier instante (solo el escalonado deriva despacio).
    for (const kind of ['line', 'pins', 'ring'] as const) expect(formationSlots({ kind, ...unit }, 6, 0)).toEqual(formationSlots({ kind, ...unit }, 6, 9.5));
    // Bolos: uno al frente, dos detrás y tres al final, cada fila centrada en el carril del líder.
    const pins = formationSlots({ kind: 'pins', ...unit }, 6, 0);
    expect(pins[0]).toEqual({ back: 0, lift: 0 });
    expect(pins[1].back).toBeCloseTo(pins[2].back, 8);
    expect(pins[1].lift).toBeCloseTo(-pins[2].lift, 8);
    expect(pins[3].back).toBeCloseTo(pins[5].back, 8);
    expect(pins[4].lift).toBeCloseTo(0, 8);
    expect(pins[3].lift).toBeCloseTo(-pins[5].lift, 8);
    expect(pins[1].back).toBeGreaterThan(pins[0].back);
    expect(pins[3].back).toBeGreaterThan(pins[1].back);
    expect(Math.abs(pins[5].lift)).toBeGreaterThan(Math.abs(pins[2].lift));
    expect(new Set(pins.map((slot) => slot.back.toFixed(6))).size).toBe(3);
    // Círculo: el líder al frente y los seis repartidos alrededor, sin que dos coincidan.
    const ring = formationSlots({ kind: 'ring', ...unit }, 6, 0);
    expect(ring[0]).toEqual({ back: 0, lift: 0 });
    expect(new Set(ring.map((slot) => `${slot.back.toFixed(3)}/${slot.lift.toFixed(3)}`)).size).toBe(6);
  });

  it('los puestos son determinísticos y cambian de signo según hacia dónde caminan', () => {
    const east = planWalker(falinks, viewport, random, { direction: 'east', formation: 'pins' });
    const west = planWalker(falinks, viewport, random, { direction: 'west', formation: 'pins' });
    expect(groupSlots(east, 1234)).toEqual(groupSlots(east, 1234));
    const [a, b] = [groupSlots(east, 800), groupSlots(west, 800)];
    for (let index = 0; index < 6; index++) {
      expect(a[index].dx).toBeLessThanOrEqual(0);
      expect(b[index].dx).toBeGreaterThanOrEqual(0);
      expect(a[index].dx).toBeCloseTo(-b[index].dx, 8);
      expect(a[index].dy).toBeCloseTo(b[index].dy, 8);
    }
    expect(groupSlots(planWalker(bulbasaur, viewport, random, { direction: 'east' }), 0)).toEqual([]);
  });

  it('entra con todos fuera y sale cuando cruzó el último miembro, en toda escena, forma y dirección', () => {
    for (const scene of scenes) for (const kind of FORMATION_KINDS) for (const direction of ['east', 'west'] as const) for (const shiny of [false, true]) {
      const plan = planWalker(falinks, scene, random, { direction, formation: kind, shiny });
      const span = plan.formation!.span, start = walkerFrameBounds(plan, 0, scene.rem);
      const wake = direction === 'east' ? -span : span;
      if (direction === 'east') expect(start.right + wake).toBeLessThanOrEqual(0);
      else expect(start.left + wake).toBeGreaterThanOrEqual(scene.width);
      const last = walkerPose(plan, plan.durationMs, scene.rem).x;
      expect(walkerLeftScene(plan, last, scene.width), `${scene.width} ${kind} ${direction}`).toBe(true);
      // Con el líder recién fuera por el borde de entrada de la salida, el grupo todavía no salió del todo.
      if (direction === 'east') expect(walkerLeftScene(plan, scene.width + 1, scene.width)).toBe(false);
      expect(plan.canAppear, `${scene.width} ${kind}`).toBe(true);
      expect(walkerExtents(falinks, plan.variant, plan.scale, scene.rem).height).toBeLessThanOrEqual(walkerVerticalArea(falinks, scene) - 2 * scene.rem + 0.01);
    }
  });

  it('los pies de todos los miembros pisan siempre el pasto, nunca el agua, en cualquier carril, forma e instante', () => {
    const grassScenes = [...scenes, { ...viewport, width: 390, height: 844, ground: 160 }, { ...viewport, width: 1280, height: 720, ground: 232 }, { ...viewport, width: 3840, height: 2160, rem: 30, artPixel: 8, ground: 672 }];
    // Como en la escena real: las copas de los árboles (skyFloor) quedan por encima del pasto, con el agua en el medio.
    const withWater = grassScenes.map((scene) => ({ ...scene, skyFloor: scene.height - scene.ground - 0.4 * scene.ground }));
    for (const scene of withWater) for (const kind of FORMATION_KINDS) for (const lane of [0, 0.25, 0.5, 0.75, 1]) for (const direction of ['east', 'west'] as const) {
      const plan = planWalker(falinks, scene, () => lane === 1 ? 0.999 : lane, { direction, formation: kind });
      if (!plan.canAppear) continue;
      const top = scene.height - scene.ground;
      for (const seconds of [0, 0.4, 1.3, 2.9, 6.1, 11, 20]) {
        for (const slot of formationSlots(plan.formation!, 6, seconds)) {
          expect(plan.feetY + slot.lift, `${scene.width}x${scene.height} ${kind} ${lane} ${seconds}`).toBeGreaterThanOrEqual(top);
          expect(plan.feetY + slot.lift, `${scene.width}x${scene.height} ${kind} ${lane} ${seconds}`).toBeLessThanOrEqual(scene.height);
        }
      }
    }
    // Y en las escenas de prueba el grupo siempre encuentra lugar.
    for (const scene of scenes) for (const kind of FORMATION_KINDS) expect(planWalker(falinks, scene, random, { direction: 'east', formation: kind }).canAppear).toBe(true);
  });

  it('el grupo reserva el espacio vertical de su formación y un solitario no cambia', () => {
    const plan = planWalker(falinks, viewport, random, { direction: 'east', formation: 'pins' });
    const solo = { ...falinks, group: undefined };
    const grouped = walkerExtents(falinks, plan.variant, plan.scale, viewport.rem), single = walkerExtents(solo, plan.variant, plan.scale, viewport.rem);
    expect(grouped.top - single.top).toBeCloseTo(GROUP_LIFT * plan.formation!.unitH, 6);
    expect(grouped.bottom - single.bottom).toBeCloseTo(GROUP_LIFT * plan.formation!.unitH, 6);
    expect(planWalker(bulbasaur, viewport, random, { direction: 'east' }).formation).toBeUndefined();
  });
});

describe('desfile de Eevee y sus evoluciones', () => {
  const members = PARADE_IDS.map((id) => manifest.pokemon.find((pokemon) => pokemon.entityId === id)!);

  it('están Eevee y las ocho evoluciones, todas de suelo y con variocolor', () => {
    expect(PARADE_IDS).toEqual(['eevee', 'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon']);
    for (const member of members) {
      expect(member, 'falta en el manifiesto').toBeDefined();
      expect(member.zone).toBe('ground');
      expect(member.variants.shiny).not.toBeNull();
    }
  });

  it('el desfile reparte a todas una sola vez, por los dos lados, y nunca una pegada a la otra', () => {
    for (const scene of [{ rem: 16 }, { rem: 30 }]) {
      for (const seed of [0, 0.3, 0.55, 0.7, 0.999]) {
        const widths = Object.fromEntries(PARADE_IDS.map((id, index) => [id, 60 + index * 15]));
        const lineup = planParade(PARADE_IDS.map((id) => ({ id, width: widths[id] })), scene, () => seed);
        expect([...lineup.map((entry) => entry.id)].sort()).toEqual([...PARADE_IDS].sort());
        const east = lineup.filter((entry) => entry.direction === 'east'), west = lineup.filter((entry) => entry.direction === 'west');
        expect(east.length).toBeGreaterThanOrEqual(4);
        expect(west.length).toBeGreaterThanOrEqual(4);
        expect(east.length + west.length).toBe(PARADE_IDS.length);
        for (const side of [east, west]) {
          for (let index = 1; index < side.length; index++) {
            // Misma velocidad: la distancia de salida es la que mantienen toda la marcha. Siempre más que sus anchos juntos.
            const gap = side[index].behind - side[index - 1].behind;
            expect(gap, `${seed} ${side[index].id}`).toBeGreaterThanOrEqual((widths[side[index].id] + widths[side[index - 1].id]) / 2 * 1.15);
          }
        }
      }
    }
    // Con otro azar cambian el orden y el reparto entre los lados.
    let n = 0;
    const noise = () => { n = (n * 7 + 3) % 11; return n / 11; };
    const members = PARADE_IDS.map((id) => ({ id, width: 80 }));
    const first = planParade(members, { rem: 16 }, noise).map((entry) => `${entry.id}${entry.direction}`).join();
    const second = planParade(members, { rem: 16 }, noise).map((entry) => `${entry.id}${entry.direction}`).join();
    expect(first).not.toBe(second);
  });

  it('a cada lado le toca un número parecido y un mismo desfile usa ambas direcciones', () => {
    const counts = new Set<number>();
    for (const seed of [0.1, 0.4, 0.6, 0.9]) {
      const lineup = planParade(PARADE_IDS.map((id) => ({ id, width: 80 })), { rem: 16 }, () => seed);
      counts.add(lineup.filter((entry) => entry.direction === 'east').length);
      expect(new Set(lineup.map((entry) => entry.direction))).toEqual(new Set(['east', 'west']));
    }
    expect([...counts].every((count) => count === 4 || count === 5)).toBe(true);
  });

  it('el ancho de cuerpo sale de la escala real del Pokémon en la escena', () => {
    for (const member of members) {
      const wide = walkerBodyWidth(member, viewport), narrow = walkerBodyWidth(member, { ...viewport, width: 360, height: 640, ground: 224 });
      expect(wide).toBeGreaterThan(10);
      expect(narrow).toBeGreaterThan(10);
    }
  });

  it('con laneGap los carriles ocupados se alejan más entre sí', () => {
    const ground = { ...viewport, occupiedLanes: [900] };
    const near = Array.from({ length: 40 }, (_, i) => chooseGroundLane(744, 1060, 120, ground, () => i / 40).feetY);
    const wide = Array.from({ length: 40 }, (_, i) => chooseGroundLane(744, 1060, 120, { ...ground, laneGap: 60 }, () => i / 40).feetY);
    expect(near.every((feet) => Math.abs(feet - 900) >= 16 - 1e-9)).toBe(true);
    expect(wide.every((feet) => Math.abs(feet - 900) >= 60 - 1e-9)).toBe(true);
  });

  it('todas van al mismo ritmo y la que sale más atrás llega más tarde, en ambas direcciones y escenas', () => {
    for (const scene of [viewport, { ...viewport, width: 360, height: 640, ground: 224 }]) for (const direction of ['east', 'west'] as const) {
      for (const member of members) {
        const near = planWalker(member, scene, random, { direction, speedRem: PARADE_SPEED_REM, behind: 0 });
        const far = planWalker(member, scene, random, { direction, speedRem: PARADE_SPEED_REM, behind: 200 });
        expect(near.speed).toBeCloseTo(PARADE_SPEED_REM * scene.rem, 8);
        expect(far.speed).toBeCloseTo(near.speed, 8);
        expect(Math.abs(far.start - near.start)).toBeCloseTo(200, 6);
        expect(far.durationMs).toBeGreaterThan(near.durationMs);
        expect(far.durationMs - near.durationMs).toBeCloseTo(200 / near.speed * 1000, 3);
        // Sale más atrás que la entrada normal: sigue empezando fuera de la pantalla.
        expect(direction === 'east' ? far.start < near.start : far.start > near.start).toBe(true);
        // Sin el pedido del desfile, cada uno trae su propio ritmo (entre 0,9 y 1,1 veces el normal).
        expect(planWalker(member, scene, () => 0.9, { direction }).speed).not.toBe(near.speed);
      }
    }
  });

  it('Eevee se dibuja con un tamaño parecido al de sus evoluciones, no mucho más chico', () => {
    const eevee = members.find((member) => member.entityId === 'eevee')!;
    expect(eevee.walkHeightMeters).toBe(0.65);
    expect(withWalkerHeights([eevee], entities)[0].heightMeters).toBe(0.65);
    for (const scene of [viewport, { ...viewport, width: 390, height: 844, artPixel: 2, ground: 224 }]) {
      const height = (member: typeof eevee) => Math.max(...Object.values(member.variants.normal.animations.Walk.directions).map((sheet) => sheet.bbox.height)) * walkerScale(member, member.variants.normal, scene);
      const others = members.filter((member) => member.entityId !== 'eevee').map(height);
      expect(height(eevee)).toBeGreaterThan(0.75 * Math.min(...others));
      expect(height(eevee)).toBeLessThan(Math.max(...others));
    }
  });

  it('el próximo evento llega entre ocho y doce minutos después', () => {
    expect(nextEventMs(1000, () => 0)).toBe(481_000);
    expect(nextEventMs(1000, () => 1)).toBe(721_000);
    expect(nextEventMs(0, () => 0.5)).toBe(600_000);
  });
});

describe('vuelo de Latios y Latias', () => {
  const duo = DUO_IDS.map((id) => manifest.pokemon.find((pokemon) => pokemon.entityId === id)!);
  const skyScene = { ...viewport, skyFloor: 604 };

  it('son los dos, de cielo y con variocolor', () => {
    expect(DUO_IDS).toEqual(['latios', 'latias']);
    for (const member of duo) {
      expect(member.zone).toBe('sky');
      expect(member.variants.shiny).not.toBeNull();
    }
    expect(DUO_SPEED_REM).toBe(4);
  });

  it('los dos van para el mismo lado, bien separados y cada uno en su mitad del cielo, en cualquier azar', () => {
    for (const seed of [0, 0.2, 0.45, 0.6, 0.999]) {
      const widths = { latios: 140, latias: 110 };
      const lineup = planDuo(DUO_IDS.map((id) => ({ id, width: widths[id as 'latios' | 'latias'] })), { rem: 16 }, () => seed);
      expect(lineup.map((entry) => entry.id).sort()).toEqual(['latias', 'latios']);
      expect(new Set(lineup.map((entry) => entry.direction)).size).toBe(1);
      const [first, second] = lineup;
      expect(second.behind - first.behind).toBeGreaterThanOrEqual((widths.latios + widths.latias) / 2 * 1.6 + 4 * 16 - 1e-9);
      expect([first.band, second.band].map((band) => band.join()).sort()).toEqual(['0,0.45', '0.55,1']);
    }
    // El azar cambia el lado y cuál va primero.
    const sides = new Set(), firsts = new Set();
    let t = 12345;
    const noise = () => { t = (t * 1664525 + 1013904223) % 4294967296; return t / 4294967296; };
    for (let i = 0; i < 12; i++) {
      const lineup = planDuo(DUO_IDS.map((id) => ({ id, width: 100 })), { rem: 16 }, noise);
      sides.add(lineup[0].direction); firsts.add(lineup[0].id);
    }
    expect(sides.size).toBe(2);
    expect(firsts.size).toBe(2);
  });

  it('cada uno vuela dentro de su franja y a la misma velocidad, sin cruzarse de altura', () => {
    for (const direction of ['east', 'west'] as const) for (const seed of [0, 0.5, 0.999]) {
      const [low, high] = [[0.55, 1], [0, 0.45]] as const;
      for (const member of duo) {
        const upper = planWalker(member, skyScene, () => seed, { direction, speedRem: DUO_SPEED_REM, band: high });
        const lower = planWalker(member, skyScene, () => seed, { direction, speedRem: DUO_SPEED_REM, band: low });
        expect(upper.speed).toBeCloseTo(DUO_SPEED_REM * skyScene.rem, 8);
        expect(upper.y).toBeLessThanOrEqual(lower.y + 1e-9);
        expect(upper.canAppear && lower.canAppear).toBe(true);
      }
    }
    // Sin franja nada cambia: el cielo entero.
    const free = planWalker(duo[0], skyScene, () => 0.5, { direction: 'east' });
    const full = planWalker(duo[0], skyScene, () => 0.5, { direction: 'east', band: [0, 1] });
    expect(free.y).toBeCloseTo(full.y, 8);
  });
});

describe('ocho eventos raros', () => {
  const scenes = [viewport, { ...viewport, width: 390, height: 844, artPixel: 2, ground: 224 }, { ...viewport, width: 844, height: 390, ground: 160 }];
  const seeds = [0, 0.13, 0.3, 0.5, 0.71, 0.9, 0.999];
  const at = (value: number) => () => value;
  const find = (id: string) => manifest.pokemon.find((pokemon) => pokemon.entityId === id)!;
  const sameDirection = (entries: readonly EventEntry[]) => new Set(entries.map((entry) => entry.direction)).size === 1;
  /**
   * Aire real entre el borde del cuerpo de un integrante y el del anterior, al salir (misma velocidad: es el que mantienen toda la marcha).
   * Positivo: hay espacio; negativo: se pisan en horizontal.
   */
  const edgeGaps = (entries: readonly EventEntry[], scene: typeof viewport) => entries.slice(1).map((entry, index) => {
    const previous = entries[index], direction = entry.direction;
    const start = (item: EventEntry) => planWalker(find(item.id), scene, at(0.5), { direction, behind: item.behind }).start;
    const before = walkerBodyExtent(find(previous.id), scene, direction), after = walkerBodyExtent(find(entry.id), scene, direction);
    const gap = direction === 'east' ? start(previous) + before.left - (start(entry) + after.right) : start(entry) + after.left - (start(previous) + before.right);
    return { id: entry.id, gap, smaller: Math.min(walkerBodyWidth(find(previous.id), scene), walkerBodyWidth(find(entry.id), scene)) };
  });

  it('la bolsa saca los ocho una vez cada uno antes de repetir', () => {
    let bag: readonly (typeof EVENT_KINDS)[number][] = [];
    let n = 0;
    const noise = () => { n = (n * 7 + 5) % 17; return n / 17; };
    for (let round = 0; round < 3; round++) {
      const seen: string[] = [];
      for (let index = 0; index < EVENT_KINDS.length; index++) { const draw = drawEventKind(bag, noise); seen.push(draw.kind); bag = draw.bag; }
      expect([...seen].sort()).toEqual([...EVENT_KINDS].sort());
      expect(bag).toHaveLength(0);
    }
    expect(EVENT_KINDS).toHaveLength(8);
  });

  it('sin alguno de los integrantes en el manifiesto, no se arma el evento', () => {
    for (const kind of EVENT_KINDS) expect(planEvent(kind, [], viewport, random), kind).toBeNull();
    expect(planEvent('dogs', manifest.pokemon.filter((pokemon) => pokemon.entityId !== 'entei'), viewport, random)).toBeNull();
  });

  it('perros legendarios: los tres para el mismo lado; uno al medio, un poco atrás y arriba el segundo, más atrás y abajo el tercero', () => {
    expect(DOG_IDS).toEqual(['raikou', 'entei', 'suicune']);
    for (const scene of scenes) for (const seed of seeds) {
      const entries = planEvent('dogs', manifest.pokemon, scene, at(seed))!;
      expect(entries.map((entry) => entry.id).sort()).toEqual([...DOG_IDS].sort());
      expect(sameDirection(entries)).toBe(true);
      const [lead, second, third] = entries;
      expect(lead.lane).toBe(0.5);
      expect(second.lane!).toBeLessThan(0.5);
      expect(third.lane!).toBeGreaterThan(0.5);
      expect(second.lane! + third.lane!).toBeCloseTo(1, 8);
      expect(entries.every((entry) => entry.speedRem === DOG_SPEED_REM)).toBe(true);
      // Un poco atrás: pegados pero sin pisarse, y sin un hueco grande entre ellos.
      for (const { gap, smaller, id } of edgeGaps(entries, scene)) {
        expect(gap, `${id} ${scene.width}`).toBeGreaterThanOrEqual(0.12 * smaller + 0.5 * scene.rem - 1e-6);
        expect(gap, `${id} ${scene.width}`).toBeLessThanOrEqual(0.3 * smaller + scene.rem);
      }
    }
  });

  it('pájaros legendarios: los seis (normales y de Galar), tres para cada lado y cada volador en su franja', () => {
    expect(BIRD_IDS).toHaveLength(6);
    const splits = new Set<string>();
    for (const scene of scenes) for (const seed of seeds) {
      const entries = planEvent('birds', manifest.pokemon, scene, at(seed))!;
      expect(entries.map((entry) => entry.id).sort()).toEqual([...BIRD_IDS].sort());
      const east = entries.filter((entry) => entry.direction === 'east'), west = entries.filter((entry) => entry.direction === 'west');
      expect(east).toHaveLength(3);
      expect(west).toHaveLength(3);
      splits.add(east.map((entry) => entry.id).sort().join());
      expect(entries.every((entry) => entry.speedRem === BIRD_SPEED_REM)).toBe(true);
      const flyers = entries.filter((entry) => find(entry.id).zone === 'sky'), runner = entries.filter((entry) => find(entry.id).zone === 'ground');
      expect(flyers).toHaveLength(5);
      expect(runner.map((entry) => entry.id)).toEqual(['zapdos-galar']);
      expect(runner[0].lane).toBeGreaterThanOrEqual(0.3);
      expect(runner[0].lane).toBeLessThanOrEqual(0.7);
      expect(new Set(flyers.map((entry) => entry.band!.join())).size).toBe(5);
      for (const entry of flyers) { expect(entry.band![0]).toBeGreaterThanOrEqual(0); expect(entry.band![1]).toBeLessThanOrEqual(1); expect(entry.band![1] - entry.band![0]).toBeCloseTo(0.2, 8); }
      // Los de un mismo lado salen con aire entre sus bordes: no se pisan.
      for (const side of [east, west]) for (const { gap, id } of edgeGaps(side, scene)) expect(gap, `${id} ${scene.width}`).toBeGreaterThanOrEqual(2 * scene.rem - 1e-6);
    }
    // Con otro azar cambian cuáles tres van a cada lado.
    expect(splits.size).toBeGreaterThan(2);
  });

  it('familia: cuña como los perros (uno al medio, otro atrás arriba, otro más atrás abajo), de la más chica a la más grande, sin huecos grandes', () => {
    for (const line of FAMILY_LINES) for (const id of line) expect(find(id)?.zone, id).toBe('ground');
    const used = new Set<string>();
    for (const scene of scenes) for (const seed of seeds) {
      const entries = planEvent('family', manifest.pokemon, scene, at(seed))!;
      expect(entries).toHaveLength(3);
      expect(FAMILY_LINES.some((line) => line.join() === entries.map((entry) => entry.id).join())).toBe(true);
      used.add(entries.map((entry) => entry.id).join());
      expect(sameDirection(entries)).toBe(true);
      const [lead, second, third] = entries;
      expect(lead.lane).toBe(0.5);
      expect(second.lane!).toBeLessThan(0.5);
      expect(third.lane!).toBeGreaterThan(0.5);
      expect(entries.every((entry) => entry.speedRem === FAMILY_SPEED_REM)).toBe(true);
      for (const { gap, smaller, id } of edgeGaps(entries, scene)) {
        expect(gap, `${id} ${scene.width}`).toBeGreaterThanOrEqual(0.12 * smaller + 0.5 * scene.rem - 1e-6);
        expect(gap, `${id} ${scene.width}`).toBeLessThanOrEqual(0.3 * smaller + scene.rem);
      }
    }
    expect(used.size).toBeGreaterThan(3);
  });

  it('todas las familias, una por una, en todas las escenas y hacia los dos lados: nunca un hueco grande ni se pisan', () => {
    const lines = FAMILY_LINES.filter((line) => line.every((id) => find(id)?.zone === 'ground'));
    expect(lines).toHaveLength(FAMILY_LINES.length);
    const worst: { line: string; gap: number; smaller: number }[] = [];
    for (const line of lines) for (const scene of scenes) for (const direction of ['east', 'west'] as const) {
      // Fuerza esta línea y este lado: el manifiesto reducido deja una sola línea posible; el primer sorteo decide el lado y el segundo la línea.
      const only = manifest.pokemon.filter((pokemon) => !FAMILY_LINES.flat().includes(pokemon.entityId) || line.includes(pokemon.entityId));
      const entries = planEvent('family', only, scene, (() => { const values = [direction === 'east' ? 0 : 0.9, 0]; let i = 0; return () => values[Math.min(i++, 1)]; })());
      if (!entries || entries.map((entry) => entry.id).join() !== line.join()) continue;
      for (const { gap, smaller } of edgeGaps(entries, scene)) {
        worst.push({ line: `${line[0]} ${scene.width} ${direction}`, gap, smaller });
        expect(gap, `${line.join('>')} ${scene.width} ${direction}`).toBeGreaterThanOrEqual(0.12 * smaller + 0.5 * scene.rem - 1e-6);
        expect(gap, `${line.join('>')} ${scene.width} ${direction}`).toBeLessThanOrEqual(0.3 * smaller + scene.rem);
      }
    }
    // Se probó de verdad cada línea (al menos una escena y un lado).
    expect(new Set(worst.map((entry) => entry.line.split(' ')[0])).size).toBe(FAMILY_LINES.length);
  });

  it('carrera: Voltorb y Electrode en carriles distintos, y Electrode más rápido', () => {
    expect(RACE_SPEEDS_REM.electrode).toBeGreaterThan(RACE_SPEEDS_REM.voltorb);
    for (const scene of scenes) for (const seed of seeds) {
      const entries = planEvent('race', manifest.pokemon, scene, at(seed))!;
      expect(entries.map((entry) => entry.id).sort()).toEqual(['electrode', 'voltorb']);
      expect(sameDirection(entries)).toBe(true);
      expect(entries[0].lane).not.toBe(entries[1].lane);
      for (const entry of entries) expect(entry.speedRem).toBe(RACE_SPEEDS_REM[entry.id]);
      for (const entry of entries) expect(entry.behind).toBeLessThanOrEqual(2 * scene.rem);
    }
  });

  it('brote: muchos Diglett y Dugtrio, más de uno de cada especie permitido y cada uno un poco después del anterior', () => {
    for (const scene of scenes) for (const seed of seeds) {
      const entries = planEvent('outbreak', manifest.pokemon, scene, at(seed))!;
      const compact = scene.width < 768 || scene.height <= 26 * scene.rem;
      expect(entries).toHaveLength(compact ? OUTBREAK_COUNT.compact : OUTBREAK_COUNT.regular);
      expect(entries.every((entry) => ['diglett', 'dugtrio'].includes(entry.id) && entry.copy === true)).toBe(true);
      for (let index = 1; index < entries.length; index++) expect(entries[index].delayMs! - entries[index - 1].delayMs!).toBeGreaterThanOrEqual(150);
      expect(entries[0].delayMs).toBe(0);
    }
    const mix = planEvent('outbreak', manifest.pokemon, viewport, (() => { let t = 7; return () => { t = (t * 1664525 + 1013904223) % 4294967296; return t / 4294967296; }; })())!;
    expect(new Set(mix.map((entry) => entry.id)).size).toBe(2);
  });

  it('un carril pedido deja los pies ahí si cabe y, si no, en el borde más cercano; sin carril nada cambia', () => {
    const scene = { ...viewport, skyFloor: 604 };
    const groundTop = scene.height - scene.ground;
    for (const id of ['raikou', 'bulbasaur', 'groudon', 'onix']) {
      const member = find(id);
      for (const lane of [0, 0.3, 0.5, 0.8, 1]) {
        const target = groundTop + lane * scene.ground;
        const plan = planWalker(member, scene, at(0.5), { direction: 'east', feetY: target });
        expect(plan.canAppear, id).toBe(true);
        expect(plan.feetY, `${id} ${lane}`).toBeGreaterThanOrEqual(groundTop);
        expect(plan.feetY, `${id} ${lane}`).toBeLessThanOrEqual(scene.height);
        if (lane === 0.5 && id !== 'groudon' && id !== 'onix') expect(plan.feetY).toBeCloseTo(target, 6);
      }
    }
    expect(planWalker(find('bulbasaur'), scene, at(0.5), { direction: 'east' }).feetY).toBe(planWalker(find('bulbasaur'), scene, at(0.5), { direction: 'east', feetY: undefined }).feetY);
    // Dos con el mismo carril pedido quedan con los mismos pies: la marcha de la familia va en fila.
    const a = planWalker(find('ivysaur'), { ...scene, occupiedLanes: [groundTop + 0.5 * scene.ground] }, at(0.5), { direction: 'east', feetY: groundTop + 0.5 * scene.ground });
    const b = planWalker(find('venusaur'), { ...scene, occupiedLanes: [groundTop + 0.5 * scene.ground] }, at(0.5), { direction: 'east', feetY: groundTop + 0.5 * scene.ground });
    expect(a.feetY).toBeCloseTo(b.feetY, 6);
  });
});

describe('lago: nadadores en el río', () => {
  const swimmers = LAKE_IDS.map((id) => manifest.pokemon.find((pokemon) => pokemon.entityId === id)!);
  const river = { ...viewport, skyFloor: 604, water: { top: 640, bottom: 740 } };
  const scenes = [river, { ...viewport, width: 390, height: 844, artPixel: 2, ground: 224, skyFloor: 560, water: { top: 560, bottom: 620 } }, viewport];

  it('los quince nadadores son de agua, sin patas que pisen: solo la animación de nado y nada de tropiezo ni sueño', () => {
    expect(LAKE_IDS).toHaveLength(15);
    expect(LAKE_IDS).toEqual(expect.arrayContaining(['lapras', 'kyogre', 'finizen', 'palafin', 'tentacool', 'tentacruel', 'phione', 'manaphy']));
    expect(new Set(LAKE_IDS).size).toBe(LAKE_IDS.length);
    for (const member of swimmers) {
      expect(member.zone).toBe('water');
      expect(member.movement).toBe('walk');
      expect(Object.keys(member.variants.normal.animations)).toEqual(['Walk']);
      expect(member.variants.normal.hasHitGround).toBe(false);
      expect(member.variants.normal.sleep).toBeNull();
      expect(member.variants.shiny).not.toBeNull();
    }
  });

  it('Kyogre se hunde más que Lapras: la línea de flotación queda justo debajo del ojo', () => {
    const lapras = swimmers.find((member) => member.entityId === 'lapras')!, kyogre = swimmers.find((member) => member.entityId === 'kyogre')!;
    expect(lapras.submergeFraction).toBeUndefined();
    expect(kyogre.submergeFraction).toBe(0.44);
    const plan = (member: typeof lapras) => planWalker(member, river, () => 0.5, { direction: 'east' });
    // El ojo de Kyogre está al 50 % del alto de su cuerpo: el agua llega al 56 %, debajo del ojo.
    expect(1 - kyogre.submergeFraction!).toBeGreaterThan(0.5);
    expect(1 - kyogre.submergeFraction!).toBeLessThan(0.6);
    expect(plan(kyogre).submerge! / plan(kyogre).visibleHeight).toBeGreaterThan(plan(lapras).submerge! / plan(lapras).visibleHeight);
  });

  it('en las apariciones normales, un nadador sale solo cuando toca, y nunca en el pasto ni en el cielo', () => {
    const population = walkerPopulation(1920, 1080, 16);
    const request = (actors: { zone: 'ground' | 'sky' | 'water'; walking: boolean }[], waterReady: boolean) => ({ bags: createWalkerBags(), pokemon: manifest.pokemon, actors, population, now: 10_000, nextAt: 0, pending: false, lastDirection: null, previous: [], width: 1920, rem: 16, waterReady });
    const walking = (zone: 'ground' | 'sky' | 'water', count: number) => Array.from({ length: count }, () => ({ zone, walking: true }));
    const seen = new Set<string>();
    for (let value = 0; value < 1; value += 0.05) {
      // Toca nadador y ya hay suelo y cielo: sale uno de agua.
      const swim = chooseReplenishment(request([...walking('ground', 2), ...walking('sky', 1)], true), () => value)!;
      expect(swim.pokemon.zone).toBe('water');
      expect(LAKE_IDS).toContain(swim.pokemon.entityId);
      seen.add(swim.pokemon.entityId);
      // Si todavía no toca, sale otro de suelo o cielo (o ninguno), nunca de agua.
      const dry = chooseReplenishment(request([...walking('ground', 2), ...walking('sky', 1)], false), () => value);
      if (dry) expect(dry.pokemon.zone).not.toBe('water');
      // Con dos nadando, nunca sale otro.
      const crowded = chooseReplenishment(request([...walking('ground', 1), ...walking('water', 2)], true), () => value);
      if (crowded) expect(crowded.pokemon.zone).not.toBe('water');
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('el río: sin medirlo hay una franja sobre el pasto, y el cuerpo puede subir dos veces y media su alto', () => {
    const band = waterBand(viewport);
    expect(band.bottom).toBeLessThan(viewport.height - viewport.ground);
    expect(band.top).toBeLessThan(band.bottom);
    expect(waterBand(river)).toEqual(river.water);
    expect(waterCeiling(river)).toBeCloseTo(740 - 2.5 * 100, 8);
    expect(walkerVerticalArea(swimmers[0], river)).toBeCloseTo(250, 8);
  });

  it('cada nadador, en cada escena, entra fuera de la pantalla y flota con los pies dentro del río en toda la marcha', () => {
    for (const scene of scenes) for (const member of swimmers) for (const direction of ['east', 'west'] as const) for (const seed of [0, 0.5, 0.999]) {
      const plan = planWalker(member, scene, () => seed, { direction });
      const band = waterBand(scene);
      expect(plan.canAppear, `${member.entityId} ${scene.width}`).toBe(true);
      // La línea de flotación queda dentro del río; el tercio de abajo del cuerpo va sumergido (y no se dibuja).
      expect(plan.feetY).toBeGreaterThanOrEqual(band.top + 0.5 * scene.rem - 1e-6);
      expect(plan.feetY).toBeLessThanOrEqual(band.bottom - 0.5 * scene.rem + 1e-6);
      expect(plan.submerge).toBeCloseTo((member.submergeFraction ?? 0.35) * plan.visibleHeight, 8);
      const walking = locomotionAnimation(member, plan.variant).directions[direction];
      expect(plan.y + (walking.bbox.y + walking.bbox.height - walking.anchor.y) * plan.scale).toBeCloseTo(plan.feetY + plan.submerge!, 6);
      expect(plan.depth).toBeGreaterThanOrEqual(WATER_DEPTH_MIN);
      expect(plan.depth).toBeLessThanOrEqual(WATER_DEPTH_MAX);
      const start = walkerFrameBounds(plan, 0, scene.rem);
      if (direction === 'east') expect(start.right).toBeLessThanOrEqual(0); else expect(start.left).toBeGreaterThanOrEqual(scene.width);
      expect(walkerExtents(member, plan.variant, plan.scale, scene.rem).height).toBeLessThanOrEqual(walkerVerticalArea(member, scene) - 2 * scene.rem + 0.01);
    }
  });

  it('un carril pedido deja los pies en esa altura del río', () => {
    for (const member of swimmers) for (const lane of [0.35, 0.8]) {
      const band = river.water;
      const plan = planWalker(member, river, () => 0.5, { direction: 'east', feetY: band.top + lane * (band.bottom - band.top) });
      expect(plan.canAppear).toBe(true);
      expect(plan.feetY).toBeGreaterThanOrEqual(band.top);
      expect(plan.feetY).toBeLessThanOrEqual(band.bottom);
    }
    // Un Pokémon de suelo no se sumerge.
    expect(planWalker(bulbasaur, viewport, random, { direction: 'east' }).submerge).toBeUndefined();
  });

  it('más arriba en el río es más lejos: lo tapan los de más abajo, sin importar quién apareció primero; y siempre detrás del pasto', () => {
    const band = river.water;
    const depthAt = (member: typeof swimmers[number], lane: number) => planWalker(member, river, () => 0.5, { direction: 'east', feetY: band.top + lane * (band.bottom - band.top) }).depth;
    for (const first of swimmers) for (const second of swimmers) {
      if (first === second) continue;
      // El que nada más arriba queda atrás, aunque haya aparecido segundo.
      expect(depthAt(first, 0.3)).toBeLessThan(depthAt(second, 0.8));
    }
    for (const member of swimmers) {
      const depths = [0, 0.25, 0.5, 0.75, 1].map((lane) => depthAt(member, lane));
      expect([...depths].sort((a, b) => a - b)).toEqual(depths);
      expect(Math.max(...depths)).toBeLessThan(100);
      expect(Math.min(...depths)).toBeGreaterThan(10);
    }
    // Y el de suelo siempre tapa a los del río.
    expect(planWalker(bulbasaur, river, () => 0, { direction: 'east' }).depth).toBeGreaterThan(WATER_DEPTH_MAX);
  });

  it('Kyogre nada siempre por la mitad de abajo del río, en el evento y fuera de él', () => {
    expect(LAKE_LOW_LANE).toEqual(['kyogre']);
    const kyogre = swimmers.find((member) => member.entityId === 'kyogre')!;
    for (const scene of scenes) for (const seed of [0, 0.25, 0.5, 0.75, 0.999]) for (const direction of ['east', 'west'] as const) {
      const band = waterBand(scene);
      const plan = planWalker(kyogre, scene, () => seed, { direction });
      expect(plan.canAppear).toBe(true);
      expect(plan.feetY).toBeGreaterThanOrEqual(band.top + 0.6 * (band.bottom - band.top) - 1e-6);
    }
    let n = 0;
    const noise = () => { n = (n * 1103515245 + 12345) % 2147483648; return n / 2147483648; };
    let withKyogre = 0;
    for (const scene of scenes) for (let round = 0; round < 80; round++) {
      const entries = planEvent('lake', manifest.pokemon, scene, noise)!;
      const kyogreEntry = entries.find((entry) => entry.id === 'kyogre');
      if (!kyogreEntry) continue;
      withKyogre++;
      expect(kyogreEntry.lane).toBe(Math.max(...entries.map((entry) => entry.lane!)));
    }
    expect(withKyogre).toBeGreaterThan(10);
  });

  it('Mantine ya no está entre los nadadores', () => {
    expect(LAKE_IDS).not.toContain('mantine');
    expect(manifest.pokemon.some((pokemon) => pokemon.entityId === 'mantine')).toBe(false);
  });

  it('el evento del lago: tres sorteados del grupo, para el mismo lado, en alturas distintas del río, sin pisarse', () => {
    const seen = new Set<string>();
    let n = 0;
    const noise = () => { n = (n * 1103515245 + 12345) % 2147483648; return n / 2147483648; };
    for (const scene of scenes) for (let round = 0; round < 10; round++) {
      const entries = planEvent('lake', manifest.pokemon, scene, noise)!;
      expect(entries).toHaveLength(LAKE_COUNT);
      expect(new Set(entries.map((entry) => entry.id)).size).toBe(LAKE_COUNT);
      entries.forEach((entry) => { expect(LAKE_IDS).toContain(entry.id); seen.add(entry.id); });
      expect(new Set(entries.map((entry) => entry.direction)).size).toBe(1);
      expect(new Set(entries.map((entry) => entry.lane)).size).toBe(LAKE_COUNT);
      expect(entries.every((entry) => entry.speedRem === LAKE_SPEED_REM && entry.lane! >= 0 && entry.lane! <= 1)).toBe(true);
      const direction = entries[0].direction;
      const find = (entry: typeof entries[number]) => manifest.pokemon.find((pokemon) => pokemon.entityId === entry.id)!;
      const start = (entry: typeof entries[number]) => planWalker(find(entry), scene, () => 0.5, { direction, behind: entry.behind }).start;
      const extent = (entry: typeof entries[number]) => walkerBodyExtent(find(entry), scene, direction);
      for (let index = 1; index < entries.length; index++) {
        const [first, second] = [entries[index - 1], entries[index]];
        const gap = direction === 'east' ? start(first) + extent(first).left - (start(second) + extent(second).right) : start(second) + extent(second).left - (start(first) + extent(first).right);
        expect(gap, `${second.id} ${scene.width}`).toBeGreaterThanOrEqual(2 * scene.rem - 1e-6);
      }
    }
    // Con otro azar salen otros: no son siempre los mismos.
    expect(seen.size).toBeGreaterThan(LAKE_COUNT + 2);
  });
});

describe('voladores nuevos: Cresselia y Darkrai', () => {
  const flyers = ['cresselia', 'darkrai'].map((id) => manifest.pokemon.find((pokemon) => pokemon.entityId === id)!);
  const sky = { ...viewport, skyFloor: 604 };

  it('Cresselia conserva sus nueve cuadros y cancela el deslizamiento lateral: el borde del cuerpo queda en el mismo lugar en todos', () => {
    const cresselia = flyers[0];
    expect((cresselia as { locomotionFrames?: unknown }).locomotionFrames).toBeUndefined();
    for (const variant of Object.values(cresselia.variants)) for (const direction of ['east', 'west'] as const) {
      const sheet = variant!.animations.Walk.directions[direction];
      expect(sheet.frames).toHaveLength(9);
      const lefts = sheet.frames.map((frame) => frame.bbox!.x + frame.offsetX!);
      // Sin la corrección el borde se movía 3 px de arte; ahora, a lo sumo 1 por el redondeo al entero.
      expect(Math.max(...sheet.frames.map((frame) => frame.bbox!.x)) - Math.min(...sheet.frames.map((frame) => frame.bbox!.x))).toBeGreaterThanOrEqual(3);
      expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(1);
    }
    // Solo ella: nadie más lleva corrección.
    for (const pokemon of manifest.pokemon.filter((entry) => entry.entityId !== 'cresselia')) for (const variant of Object.values(pokemon.variants)) if (variant) {
      for (const animation of Object.values(variant.animations)) for (const sheet of Object.values(animation.directions)) expect(sheet.frames.some((frame) => frame.offsetX !== undefined), pokemon.entityId).toBe(false);
    }
  });

  it('flotan en el cielo con su Walk, con sombra, y entran fuera de la pantalla en ambos lados', () => {
    for (const member of flyers) {
      expect(member, 'falta en el manifiesto').toBeDefined();
      expect(member.zone).toBe('sky');
      expect(member.locomotion).toBe('Walk');
      expect(member.variants.normal.animations.Walk.shadow).toBeDefined();
      for (const scene of [sky, { ...viewport, width: 390, height: 844, ground: 224, skyFloor: 560 }]) for (const direction of ['east', 'west'] as const) {
        const plan = planWalker(member, scene, random, { direction });
        expect(plan.canAppear, `${member.entityId} ${scene.width}`).toBe(true);
        const start = walkerFrameBounds(plan, 0, scene.rem);
        if (direction === 'east') expect(start.right).toBeLessThanOrEqual(0); else expect(start.left).toBeGreaterThanOrEqual(scene.width);
      }
    }
  });
});

describe('la franja de arriba del pasto, pegada al agua, no se camina', () => {
  const scenes = [viewport, { ...viewport, width: 390, height: 844, artPixel: 2, ground: 224 }, { ...viewport, width: 844, height: 390, ground: 160 }, { ...viewport, width: 3840, height: 2160, rem: 30, artPixel: 8, ground: 672 }];

  it('el margen es el 15 % del pasto, de dos rem como mínimo y un cuarto como máximo', () => {
    expect(groundTopMargin({ ground: 336, rem: 16 })).toBeCloseTo(50.4, 8);
    expect(groundTopMargin({ ground: 160, rem: 16 })).toBe(32);
    expect(groundTopMargin({ ground: 100, rem: 16 })).toBe(25);
    for (const scene of scenes) {
      expect(groundTopMargin(scene)).toBeGreaterThanOrEqual(Math.min(0.25 * scene.ground, 2 * scene.rem));
      expect(groundTopMargin(scene)).toBeLessThanOrEqual(0.25 * scene.ground);
    }
  });

  it('ningún caminante de suelo apoya los pies en la franja de arriba, en ninguna escena, lado ni carril', () => {
    let checked = 0;
    for (const scene of scenes) {
      const top = scene.height - scene.ground + groundTopMargin(scene);
      for (const pokemon of manifest.pokemon.filter((entry) => entry.zone === 'ground' && !entry.burrow)) for (const seed of [0, 0.5, 0.999]) {
        const plan = planWalker(pokemon, scene, () => seed, { direction: 'east' });
        if (!plan.canAppear) continue;
        expect(plan.feetY, `${pokemon.entityId} ${scene.width}x${scene.height}`).toBeGreaterThanOrEqual(top - 1e-6);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(2000);
  });

  it('un carril pedido (eventos) arriba del todo se corre hacia abajo, fuera de la franja', () => {
    const top = viewport.height - viewport.ground + groundTopMargin(viewport);
    for (const id of ['raikou', 'bulbasaur', 'zapdos-galar']) {
      const plan = planWalker(manifest.pokemon.find((entry) => entry.entityId === id)!, viewport, random, { direction: 'east', feetY: viewport.height - viewport.ground });
      expect(plan.feetY, id).toBeGreaterThanOrEqual(top - 1e-6);
    }
  });

  it('los de madriguera tampoco asoman en la franja de arriba', () => {
    const scene = { ...viewport };
    const top = scene.height - scene.ground + groundTopMargin(scene);
    for (const id of ['diglett', 'dugtrio']) for (const seed of [0, 0.3, 0.6, 0.999]) {
      const plan = planWalker(manifest.pokemon.find((entry) => entry.entityId === id)!, scene, () => seed);
      const placed = chooseBurrowPosition(plan, scene, () => seed);
      expect(placed, id).not.toBeNull();
      expect(burrowBounds(placed!, scene.rem).y).toBeGreaterThanOrEqual(top - 1e-6);
    }
  });
});

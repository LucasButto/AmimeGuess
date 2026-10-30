import { sameWalkerGeometry } from './walkerMotion';
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
  it('repone m?nimos por zona, con reserva para sue?o y l?mites independientes', () => {
    for (const [width, height, rem, minimum, maximum] of [[360,640,16,2,6],[390,844,16,2,6],[844,390,16,3,6],[768,1024,16,3,6],[1920,1080,16,3,6],[3840,2160,30,3,6]]) {
      const population = walkerPopulation(width,height,rem);
      expect(population.ground.min).toBe(minimum);
      expect(population.sky.min).toBe(1);
      expect(population.sky.max).toBe(2);
      expect(population.ground.max).toBe(4);
      expect(walkerCapacity(width,height,rem)).toBe(maximum);
      const actors: {zone:'ground'|'sky';walking:boolean}[] = [];
      while (replenishmentZone(actors,population)) actors.push({zone:replenishmentZone(actors,population)!,walking:true});
      expect(actors.filter(actor=>actor.zone==='ground')).toHaveLength(Math.min(minimum+1,population.ground.max));
      expect(actors.filter(actor=>actor.zone==='sky')).toHaveLength(2);
      expect(actors.length).toBeLessThanOrEqual(WALKER_MAX);
      actors.find(actor=>actor.zone==='ground')!.walking=false;
      expect(replenishmentZone(actors,population)).toBe(actors.length < WALKER_MAX && actors.filter(actor=>actor.zone==='ground').length < population.ground.max ? 'ground' : null);
      expect(replenishmentZone(actors.filter(actor=>actor.zone!=='ground').concat(Array.from({length:3},()=>({zone:'ground' as const,walking:true}))),population)).toBe(minimum === 2 ? null : 'ground');
      const full = Array.from({length:WALKER_MAX},()=>({zone:'ground' as const,walking:false}));
      expect(replenishmentZone(full,population)).toBeNull();
    }
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
    expect(checked).toBe(5984);
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
    const top=viewport.height-viewport.ground;
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
